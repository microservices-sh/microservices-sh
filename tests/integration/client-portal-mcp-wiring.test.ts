// Proves the recipe generalizes beyond booking: the client-portal template's
// hand-authored MCP wiring drives the full governed-agent loop against its REAL
// module set (auth / identity / customer / file-media), with file-media as a
// module booking does not expose.
//
// Same shape as booking-mcp-wiring: manifest built from each module's module.json
// (as scripts/generate-mcp.mjs does), handlers from the committed seam, run
// through the sdk gateway + MCP server with in-memory adapters.

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
  actorContext,
} from "../../templates/client-portal-sveltekit/src/lib/server/mcp-wiring.ts";

const lockPath = fileURLToPath(new URL("../../templates/client-portal-sveltekit/microservices.lock.json", import.meta.url));
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
function loadConnections(id: string): any {
  const path = fileURLToPath(new URL(`../../modules/${id}/module.json`, import.meta.url));
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).connections : undefined;
}
const modules = lock.modules.map((m: any) => ({ id: m.id, connections: loadConnections(m.id) }));
const manifest = modules.flatMap((m: any) => generateToolManifest(m));

function buildMcp() {
  const gateway = createToolGateway({ manifest, handlers, authorize, audit });
  return createMcpToolServer({ gateway, schemas });
}

const allScopes = [...new Set(manifest.map((t: any) => t.scope).filter(Boolean))] as string[];

describe("client-portal app MCP wiring (auth/identity/customer/file-media)", () => {
  it("exposes 14 governed tools including file-media", async () => {
    const mcp = buildMcp();
    const list: any = await mcp.handleRequest({ method: "tools/list" }, { scopes: allScopes });
    const names = list.tools.map((t: any) => t.name).sort();
    expect(names).toContain("file-media_createUploadTicket");
    expect(names).toContain("file-media_listFiles");
    expect(names).toHaveLength(14);
    // createUploadTicket is a gated mutation; listFiles is a read.
    expect(list.tools.find((t: any) => t.name === "file-media_createUploadTicket")._meta).toMatchObject({
      mutation: true,
      requiresConfirmation: true,
      scope: "media.upload",
    });
    expect(list.tools.find((t: any) => t.name === "file-media_listFiles")._meta).toMatchObject({ mutation: false });
  });

  it("file-media: read flows, upload-ticket is gated then executes on confirm", async () => {
    const mcp = buildMcp();
    const agent = { actor: "agent:portal", scopes: allScopes };

    // listFiles (read) flows freely.
    const listed: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "file-media_listFiles", arguments: { tenantId: "t1" } } },
      agent,
    );
    expect(listed.isError).toBe(false);

    // createUploadTicket (mutation) is held at the gate.
    const args = { tenantId: "t1", originalName: "contract.pdf", contentType: "application/pdf" };
    const gated: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "file-media_createUploadTicket", arguments: args } },
      agent,
    );
    expect(gated._meta).toMatchObject({ awaitingConfirmation: true, status: 202 });

    // Confirmed — the real use case runs and mints an upload ticket.
    const created: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "file-media_createUploadTicket", arguments: args } },
      { ...agent, confirmed: true },
    );
    expect(created.isError).toBe(false);

    // An upload by an actor without media.upload is denied.
    const denied: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "file-media_createUploadTicket", arguments: args } },
      { actor: "agent:nobody", scopes: [] },
    );
    expect(denied._meta).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("resolves an actor + scopes from the session env", () => {
    const ctx = actorContext();
    expect(typeof ctx.actor).toBe("string");
    expect(Array.isArray(ctx.scopes)).toBe(true);
  });
});
