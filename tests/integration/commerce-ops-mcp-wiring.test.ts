// Proves the commerce-ops template exposes BAO-style operational domains as
// governed MCP tools: product catalog, inventory, sales orders, shipments, plus
// the common auth/customer/payment/support/file tools already used by the app.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createToolGateway } from "../../packages/sdk-internal/src/tool-gateway.js";
import { createMcpToolServer } from "../../packages/sdk-internal/src/mcp-tool-server.js";
import { generateToolManifest } from "../../packages/sdk-internal/src/tool-codegen.js";

import {
  handlers,
  schemas,
  authorize,
  audit,
  actorContext
} from "../../templates/commerce-ops-sveltekit/src/lib/server/mcp-wiring.ts";

const lockPath = fileURLToPath(new URL("../../templates/commerce-ops-sveltekit/microservices.lock.json", import.meta.url));
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

function loadConnections(id: string): any {
  const path = fileURLToPath(new URL(`../../modules/${id}/module.json`, import.meta.url));
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).connections : undefined;
}

const modules = lock.modules.map((m: any) => ({ id: m.id, connections: loadConnections(m.id) }));
const manifest = modules.flatMap((m: any) => generateToolManifest(m));
const allScopes = [...new Set(manifest.map((t: any) => t.scope).filter(Boolean))] as string[];

function buildMcp() {
  const gateway = createToolGateway({ manifest, handlers, authorize, audit });
  return createMcpToolServer({ gateway, schemas });
}

describe("commerce-ops app MCP wiring", () => {
  it("exposes all installed governed RPC tools and has a handler for each one", async () => {
    const mcp = buildMcp();
    const list: any = await mcp.handleRequest({ method: "tools/list" }, { scopes: allScopes });
    const names = list.tools.map((t: any) => t.name).sort();

    expect(names).toContain("product-catalog_createProduct");
    expect(names).toContain("inventory_stockIn");
    expect(names).toContain("sales-order_createDraftOrder");
    expect(names).toContain("shipment_createShipment");
    expect(names).toContain("support-ticket_createTicket");
    expect(names).toContain("file-media_createUploadTicket");
    expect(names).toHaveLength(manifest.length);
    expect(Object.keys(handlers).sort()).toEqual(names);
  });

  it("catalog reads flow, writes gate, confirmed writes persist for later reads", async () => {
    const mcp = buildMcp();
    const agent = { actor: "agent:commerce", scopes: allScopes };

    const before: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "product-catalog_listProducts", arguments: { tenantId: "t1" } } },
      agent
    );
    expect(before.isError).toBe(false);

    const args = {
      tenantId: "t1",
      sku: "BAO-TEE",
      name: "BAO Tee",
      priceCents: 2500,
      currency: "USD",
      unit: "each"
    };

    const gated: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "product-catalog_createProduct", arguments: args } },
      agent
    );
    expect(gated._meta).toMatchObject({ awaitingConfirmation: true, status: 202 });

    const created: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "product-catalog_createProduct", arguments: args } },
      { ...agent, confirmed: true }
    );
    expect(created.isError).toBe(false);

    const after: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "product-catalog_listProducts", arguments: { tenantId: "t1" } } },
      agent
    );
    expect(after.content[0].text).toContain("BAO-TEE");
  });

  it("denies scoped commerce writes without the required scope", async () => {
    const mcp = buildMcp();
    const denied: any = await mcp.handleRequest(
      {
        method: "tools/call",
        params: {
          name: "inventory_stockIn",
          arguments: { tenantId: "t1", productId: "prod_missing", locationId: "default", quantity: 1 }
        }
      },
      { actor: "agent:nobody", scopes: [] }
    );

    expect(denied.isError).toBe(true);
    expect(denied._meta).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("resolves an actor + scopes from the session env", () => {
    const ctx = actorContext();
    expect(typeof ctx.actor).toBe("string");
    expect(Array.isArray(ctx.scopes)).toBe(true);
  });
});
