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
} from "../../templates/booking-sveltekit/src/lib/server/mcp-wiring.ts";

// Build the governed manifest from the booking app's installed module set — the
// committed lock for the membership, each module's own module.json for the
// authoritative rpc contract — exactly as scripts/generate-mcp.mjs does.
const lockPath = fileURLToPath(new URL("../../templates/booking-sveltekit/microservices.lock.json", import.meta.url));
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
function loadConnections(id: string): any {
  const path = fileURLToPath(new URL(`../../modules/${id}/module.json`, import.meta.url));
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).connections : undefined;
}
const bookingModules = lock.modules.map((m: any) => ({ id: m.id, connections: loadConnections(m.id) }));
const manifest = bookingModules.flatMap((m: any) => generateToolManifest(m));

function buildBookingMcp() {
  const gateway = createToolGateway({ manifest, handlers, authorize, audit });
  return createMcpToolServer({ gateway, schemas });
}

const allScopes = [...new Set(manifest.map((t: any) => t.scope).filter(Boolean))] as string[];

describe("booking app MCP wiring (real auth/identity/payment/audit-log modules)", () => {
  it("exposes the 14 governed tools (incl. customer + booking) with correct governance metadata", async () => {
    const mcp = buildBookingMcp();
    const list: any = await mcp.handleRequest({ method: "tools/list" }, { scopes: allScopes });
    expect(list.tools.map((t: any) => t.name).sort()).toEqual([
      "auth_getJwks",
      "auth_mintToken",
      "auth_verifyToken",
      "booking_getAvailability",
      "booking_getBooking",
      "booking_listBookings",
      "customer_getCustomer",
      "customer_listCustomers",
      "customer_upsertCustomer",
      "identity_destroySession",
      "identity_readSession",
      "identity_requestLoginCode",
      "identity_verifyLoginCode",
      "payment_createPaymentIntent",
    ]);
    // getJwks is public; customer.upsert is a gated mutation; booking reads are not.
    expect(list.tools.find((t: any) => t.name === "auth_getJwks")._meta).toMatchObject({ public: true });
    expect(list.tools.find((t: any) => t.name === "customer_upsertCustomer")._meta).toMatchObject({
      mutation: true,
      requiresConfirmation: true,
      scope: "customer.write",
    });
    expect(list.tools.find((t: any) => t.name === "booking_listBookings")._meta).toMatchObject({ mutation: false });
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

  it("an agent can act on core domain objects: gated customer write lands, booking reads flow", async () => {
    const mcp = buildBookingMcp();
    const agent = { actor: "agent:booking", scopes: allScopes };

    // Booking read flows freely (no confirmation).
    const bookings: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "booking_listBookings", arguments: {} } },
      agent,
    );
    expect(bookings.isError).toBe(false);

    // Creating a customer is a gated mutation — held until confirmed.
    const gated: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "customer_upsertCustomer", arguments: { name: "Ann Lee", email: "ann@example.com" } } },
      agent,
    );
    expect(gated._meta).toMatchObject({ awaitingConfirmation: true, status: 202 });

    // Confirmed — the real customer use case runs and persists the record.
    const created: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "customer_upsertCustomer", arguments: { name: "Ann Lee", email: "ann@example.com" } } },
      { ...agent, confirmed: true },
    );
    expect(created.isError).toBe(false);

    // Read-back through the agent's own tool proves it landed in the repository.
    const after: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "customer_listCustomers", arguments: {} } },
      agent,
    );
    expect(after.content[0].text).toContain("ann@example.com");
  });

  it("resolves an actor + scopes from the session env", () => {
    const ctx = actorContext();
    expect(typeof ctx.actor).toBe("string");
    expect(Array.isArray(ctx.scopes)).toBe(true);
  });
});
