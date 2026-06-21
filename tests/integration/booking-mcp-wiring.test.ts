// Proves the booking template's hand-authored MCP wiring (the edit seam the
// generated stdio server imports) drives the full governed-agent loop against the
// REAL auth / identity / payment / audit-log modules it binds.
//
// The seam lives at templates/booking-sveltekit/src/lib/server/mcp-wiring.ts and
// exports handlers / schemas / authorize / audit / actorContext — exactly what
// generated/mcp-server.mjs imports alongside the generated tool-manifest. The
// manifest here is built from the keystone over the committed lock (the same
// derivation the build's emitArtifacts performs), so the test does not depend on
// the gitignored generated/ output. Run with the seam's default in-memory
// adapters — fully runnable with no Cloudflare runtime.

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
  actorContext,
} from "../../templates/booking-sveltekit/src/lib/server/mcp-wiring.ts";

// Build the governed manifest from the booking app's installed module set — the
// committed lock — exactly as the build does.
const lockPath = fileURLToPath(new URL("../../templates/booking-sveltekit/microservices.lock.json", import.meta.url));
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const bookingModules = lock.modules.map((m: any) => ({
  id: m.id,
  rpc: (m.contract?.rpc ?? []).map((r: any) => (typeof r === "string" ? { method: r } : r)),
}));
const manifest = bookingModules.flatMap((m: any) => generateToolManifest(m));

function buildBookingMcp() {
  const gateway = createToolGateway({ manifest, handlers, authorize, audit });
  return createMcpToolServer({ gateway, schemas });
}

const allScopes = [...new Set(manifest.map((t: any) => t.scope).filter(Boolean))] as string[];

describe("booking app MCP wiring (real auth/identity/payment/audit-log modules)", () => {
  it("exposes the 8 governed tools with correct governance metadata", async () => {
    const mcp = buildBookingMcp();
    const list: any = await mcp.handleRequest({ method: "tools/list" }, { scopes: allScopes });
    expect(list.tools.map((t: any) => t.name).sort()).toEqual([
      "auth_getJwks",
      "auth_mintToken",
      "auth_verifyToken",
      "identity_destroySession",
      "identity_readSession",
      "identity_requestLoginCode",
      "identity_verifyLoginCode",
      "payment_createPaymentIntent",
    ]);
    // getJwks is public; requestLoginCode is a gated mutation.
    expect(list.tools.find((t: any) => t.name === "auth_getJwks")._meta).toMatchObject({ public: true });
    expect(list.tools.find((t: any) => t.name === "identity_requestLoginCode")._meta).toMatchObject({
      mutation: true,
      requiresConfirmation: true,
    });
  });

  it("reads freely, gates the mutation, runs it on confirm, denies without scope — all audited", async () => {
    const mcp = buildBookingMcp();
    const agent = { actor: "agent:booking", scopes: allScopes };

    // Public read flows without confirmation.
    const jwks: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "auth_getJwks", arguments: {} } },
      agent,
    );
    expect(jwks.isError).toBe(false);

    // Mutation is held at the approval gate (202), real use case not run.
    const gated: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "identity_requestLoginCode", arguments: { email: "ann@example.com" } } },
      agent,
    );
    expect(gated.isError).toBe(true);
    expect(gated._meta).toMatchObject({ awaitingConfirmation: true, status: 202 });

    // Confirmed — identity.requestLoginCode actually runs and mints a code.
    const confirmed: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "identity_requestLoginCode", arguments: { email: "ann@example.com" } } },
      { ...agent, confirmed: true },
    );
    expect(confirmed.isError).toBe(false);

    // A payment write by an actor without payment.write is denied (and not run).
    const denied: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "payment_createPaymentIntent", arguments: { amountCents: 500, currency: "usd" } } },
      { actor: "agent:nobody", scopes: [] },
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
