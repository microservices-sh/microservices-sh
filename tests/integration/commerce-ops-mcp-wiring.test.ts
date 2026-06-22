// Proves the commerce-ops template exposes BAO-style operational domains as
// governed MCP tools: product catalog, inventory, sales orders, shipments, plus
// the common auth/customer/payment/support/file tools already used by the app.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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

const modules = lock.modules.map((m: any) => ({
  id: m.id,
  rpc: (m.contract?.rpc ?? []).map((r: any) => (typeof r === "string" ? { method: r } : r))
}));
const manifest = modules.flatMap((m: any) => generateToolManifest(m));
const allScopes = [...new Set(manifest.map((t: any) => t.scope).filter(Boolean))] as string[];

function buildMcp() {
  const gateway = createToolGateway({ manifest, handlers, authorize, audit });
  return createMcpToolServer({ gateway, schemas });
}

async function callOk(mcp: ReturnType<typeof buildMcp>, name: string, args: Record<string, unknown>) {
  const response: any = await mcp.handleRequest(
    { method: "tools/call", params: { name, arguments: args } },
    { actor: "agent:commerce", scopes: allScopes, confirmed: true }
  );
  expect(response.isError).toBe(false);
  const payload = JSON.parse(response.content[0].text);
  expect(payload.ok).toBe(true);
  return payload.data;
}

describe("commerce-ops app MCP wiring", () => {
  it("exposes all installed governed RPC tools and has a handler for each one", async () => {
    const mcp = buildMcp();
    const list: any = await mcp.handleRequest({ method: "tools/list" }, { scopes: allScopes });
    const names = list.tools.map((t: any) => t.name).sort();

    expect(names).toContain("product-catalog_createProduct");
    expect(names).toContain("inventory_stockIn");
    expect(names).toContain("inventory_createReconciliationDocument");
    expect(names).toContain("inventory_listReconciliationDocuments");
    expect(names).toContain("inventory_completeReconciliationDocument");
    expect(names).toContain("inventory_listLowStockAlerts");
    expect(names).toContain("sales-order_createDraftOrder");
    expect(names).toContain("sales-order_bulkTransitionOrders");
    expect(names).toContain("sales-order_sendSalesOrder");
    expect(names).toContain("shipment_createShipment");
    expect(names).toContain("support-ticket_createTicket");
    expect(names).toContain("file-media_createUploadTicket");
    expect(names).not.toContain("payment_createPaymentIntent");
    expect(names).not.toContain("org-team-rbac_authorize");
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

  it("applies UI-equivalent inventory side effects for sales-order and shipment MCP tools", async () => {
    const mcp = buildMcp();
    const tenantId = "mcp-side-effects";
    const product = (
      await callOk(mcp, "product-catalog_createProduct", {
        tenantId,
        sku: "MCP-STOCK-1",
        name: "MCP stocked item",
        priceCents: 1_500,
        currency: "USD",
        trackStock: true
      })
    ).product;

    await callOk(mcp, "inventory_stockIn", {
      tenantId,
      productId: product.id,
      quantity: 12,
      sourceType: "mcp-seed",
      sourceId: "stock-1"
    });

    const cancellableOrder = (
      await callOk(mcp, "sales-order_createDraftOrder", {
        tenantId,
        customerId: "cust-mcp",
        customerSnapshot: { displayName: "MCP Customer", email: "mcp@example.com" },
        currency: "USD",
        lineItems: [{ productId: product.id, sku: product.sku, name: product.name, quantity: 4, unitPriceCents: product.priceCents }]
      })
    ).order;
    await callOk(mcp, "sales-order_bulkTransitionOrders", { tenantId, orderIds: [cancellableOrder.id], action: "confirm" });
    expect((await callOk(mcp, "inventory_getStockBalance", { tenantId, productId: product.id })).balance).toMatchObject({
      onHand: 12,
      reserved: 4,
      available: 8
    });

    await callOk(mcp, "sales-order_bulkTransitionOrders", { tenantId, orderIds: [cancellableOrder.id], action: "cancel", reason: "MCP test" });
    expect((await callOk(mcp, "inventory_getStockBalance", { tenantId, productId: product.id })).balance).toMatchObject({
      onHand: 12,
      reserved: 0,
      available: 12
    });

    const shippableOrder = (
      await callOk(mcp, "sales-order_createDraftOrder", {
        tenantId,
        customerId: "cust-mcp",
        customerSnapshot: { displayName: "MCP Customer", email: "mcp@example.com" },
        currency: "USD",
        lineItems: [{ productId: product.id, sku: product.sku, name: product.name, quantity: 3, unitPriceCents: product.priceCents }]
      })
    ).order;
    const confirmed = (await callOk(mcp, "sales-order_confirmOrder", { tenantId, orderId: shippableOrder.id })).order;
    const shipment = (
      await callOk(mcp, "shipment_createShipment", {
        tenantId,
        externalSource: "sales-order",
        externalId: confirmed.id,
        items: confirmed.lineItems.map((line: any) => ({
          sourceType: "sales-order",
          sourceId: confirmed.id,
          productId: line.productId,
          sku: line.sku,
          description: line.description || line.name,
          quantity: line.quantity
        }))
      })
    ).shipment;
    await callOk(mcp, "shipment_completeShipment", {
      tenantId,
      shipmentId: shipment.id,
      completionRef: `complete:${shipment.id}`
    });

    expect((await callOk(mcp, "inventory_getStockBalance", { tenantId, productId: product.id })).balance).toMatchObject({
      onHand: 9,
      reserved: 0,
      available: 9
    });
  });

  it("resolves an actor + scopes from the session env", () => {
    const ctx = actorContext();
    expect(typeof ctx.actor).toBe("string");
    expect(Array.isArray(ctx.scopes)).toBe(true);
  });
});
