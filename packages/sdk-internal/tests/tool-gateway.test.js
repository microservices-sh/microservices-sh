import { describe, it, expect } from "vitest";
import { createToolGateway } from "../src/tool-gateway.js";
import { generateToolManifest } from "../src/tool-codegen.js";

// A small hand-built manifest covering the four shapes the gateway gates on.
const manifest = [
  { name: "auth_getJwks", module: "auth", method: "getJwks", scope: null, public: true, mutation: false, requiresConfirmation: false },
  { name: "customer_getCustomer", module: "customer", method: "getCustomer", scope: "customer.read", public: false, mutation: false, requiresConfirmation: false },
  { name: "customer_upsertCustomer", module: "customer", method: "upsertCustomer", scope: "customer.write", public: false, mutation: true, requiresConfirmation: true },
];

function harness(overrides = {}) {
  const auditLog = [];
  const calls = [];
  const handlers = {
    auth_getJwks: async () => { calls.push("auth_getJwks"); return { keys: [] }; },
    customer_getCustomer: async (input) => { calls.push("customer_getCustomer"); return { id: input?.id ?? "c1" }; },
    customer_upsertCustomer: async (input) => { calls.push("customer_upsertCustomer"); return { id: "c1", ...input }; },
    ...overrides.handlers,
  };
  const authorize = overrides.authorize ?? (async (ctx, scope) => (ctx?.scopes ?? []).includes(scope));
  const audit = { record: async (e) => auditLog.push(e) };
  const gateway = createToolGateway({ manifest: overrides.manifest ?? manifest, handlers, authorize, audit, now: () => 1000 });
  return { gateway, auditLog, calls };
}

describe("createToolGateway — gates", () => {
  it("rejects an unknown tool (404), no audit", async () => {
    const { gateway, auditLog } = harness();
    const r = await gateway.callTool("nope_doThing", {}, { scopes: [] });
    expect(r).toMatchObject({ ok: false, status: 404, error: { code: "UNKNOWN_TOOL" } });
    expect(auditLog).toHaveLength(0);
  });

  it("runs a PUBLIC read with no scope check, and audits it", async () => {
    const { gateway, auditLog, calls } = harness();
    const r = await gateway.callTool("auth_getJwks", {}, {}); // no scopes at all
    expect(r).toMatchObject({ ok: true, status: 200, data: { keys: [] } });
    expect(calls).toEqual(["auth_getJwks"]);
    expect(auditLog.at(-1)).toMatchObject({ tool: "auth_getJwks", outcome: "executed", mutation: false });
  });

  it("runs a SCOPED read when the actor holds the scope", async () => {
    const { gateway, calls } = harness();
    const r = await gateway.callTool("customer_getCustomer", { id: "c9" }, { scopes: ["customer.read"] });
    expect(r).toMatchObject({ ok: true, data: { id: "c9" } });
    expect(calls).toEqual(["customer_getCustomer"]);
  });

  it("denies a scoped tool without the scope (403), audits 'denied', never runs the handler", async () => {
    const { gateway, auditLog, calls } = harness();
    const r = await gateway.callTool("customer_getCustomer", {}, { actor: "u1", scopes: [] });
    expect(r).toMatchObject({ ok: false, status: 403, error: { code: "FORBIDDEN" } });
    expect(calls).toEqual([]);
    expect(auditLog.at(-1)).toMatchObject({ tool: "customer_getCustomer", outcome: "denied", reason: "scope", actor: "u1" });
  });

  it("GATES a mutation until confirmed (202), audits 'awaiting_confirmation', does NOT run the handler", async () => {
    const { gateway, auditLog, calls } = harness();
    const r = await gateway.callTool("customer_upsertCustomer", { name: "Ann" }, { scopes: ["customer.write"] });
    expect(r).toMatchObject({ ok: false, status: 202, awaitingConfirmation: true, error: { code: "CONFIRMATION_REQUIRED" } });
    expect(calls).toEqual([]); // gated — handler never ran
    expect(auditLog.at(-1)).toMatchObject({ tool: "customer_upsertCustomer", outcome: "awaiting_confirmation" });
  });

  it("runs a mutation once confirmed AND scoped, audits 'executed'", async () => {
    const { gateway, auditLog, calls } = harness();
    const r = await gateway.callTool("customer_upsertCustomer", { name: "Ann" }, { scopes: ["customer.write"], confirmed: true });
    expect(r).toMatchObject({ ok: true, status: 200, data: { id: "c1", name: "Ann" } });
    expect(calls).toEqual(["customer_upsertCustomer"]);
    expect(auditLog.at(-1)).toMatchObject({ outcome: "executed", mutation: true, confirmed: true });
  });

  it("checks scope BEFORE confirmation — a confirmed mutation without the scope is still 403", async () => {
    const { gateway, calls } = harness();
    const r = await gateway.callTool("customer_upsertCustomer", {}, { scopes: [], confirmed: true });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(calls).toEqual([]);
  });

  it("surfaces a handler throw as 500 and audits 'error'", async () => {
    const { gateway, auditLog } = harness({
      handlers: { customer_getCustomer: async () => { throw new Error("db down"); } },
    });
    const r = await gateway.callTool("customer_getCustomer", {}, { scopes: ["customer.read"] });
    expect(r).toMatchObject({ ok: false, status: 500, error: { code: "HANDLER_ERROR", message: "db down" } });
    expect(auditLog.at(-1)).toMatchObject({ outcome: "error", message: "db down" });
  });

  it("reports 501 when a tool in the manifest has no wired handler", async () => {
    const { gateway } = harness({ handlers: { customer_getCustomer: undefined } });
    const r = await gateway.callTool("customer_getCustomer", {}, { scopes: ["customer.read"] });
    expect(r).toMatchObject({ ok: false, status: 501, error: { code: "NOT_WIRED" } });
  });
});

describe("createToolGateway — listTools", () => {
  it("returns the full manifest with no scope context", () => {
    const { gateway } = harness();
    expect(gateway.listTools().map((t) => t.name)).toEqual(manifest.map((t) => t.name));
  });
  it("filters to public + in-scope tools when scopes are supplied", () => {
    const { gateway } = harness();
    const visible = gateway.listTools({ scopes: ["customer.read"] }).map((t) => t.name);
    expect(visible).toEqual(["auth_getJwks", "customer_getCustomer"]); // upsert (customer.write) hidden
  });
});

describe("end-to-end governed-agent loop (manifest from a real contract)", () => {
  it("agent reads freely; a mutation is gated then runs once confirmed; every step is audited", async () => {
    const booking = {
      id: "booking",
      rpc: [
        { method: "getAvailability", scope: "booking.read", public: false },
        { method: "createBooking", scope: "booking.write", public: false },
      ],
    };
    const bookingManifest = generateToolManifest(booking);
    expect(bookingManifest.map((t) => `${t.name}:${t.mutation}`)).toEqual([
      "booking_getAvailability:false",
      "booking_createBooking:true",
    ]);

    const { gateway, auditLog, calls } = harness({
      manifest: bookingManifest,
      handlers: {
        booking_getAvailability: async () => { calls.push("avail"); return { slots: ["09:00", "10:00"] }; },
        booking_createBooking: async (input) => { calls.push("create"); return { id: "bk_1", ...input }; },
      },
    });
    const agent = { actor: "agent:concierge", scopes: ["booking.read", "booking.write"] };

    const availability = await gateway.callTool("booking_getAvailability", { date: "2026-07-01" }, agent);
    expect(availability).toMatchObject({ ok: true, data: { slots: ["09:00", "10:00"] } });

    const gated = await gateway.callTool("booking_createBooking", { slot: "09:00" }, agent);
    expect(gated).toMatchObject({ ok: false, awaitingConfirmation: true }); // approval gate held

    const confirmed = await gateway.callTool("booking_createBooking", { slot: "09:00" }, { ...agent, confirmed: true });
    expect(confirmed).toMatchObject({ ok: true, data: { id: "bk_1", slot: "09:00" } });

    // the booking was created exactly once — only after confirmation
    expect(calls).toEqual(["avail", "create"]);
    // full audit trail, in order
    expect(auditLog.map((e) => `${e.tool}:${e.outcome}`)).toEqual([
      "booking_getAvailability:executed",
      "booking_createBooking:awaiting_confirmation",
      "booking_createBooking:executed",
    ]);
    expect(auditLog.every((e) => e.actor === "agent:concierge" && e.at === 1000)).toBe(true);
  });
});
