import { describe, it, expect } from "vitest";
import { createMcpToolServer, generateMcpServerEntry } from "../src/mcp-tool-server.js";
import { createToolGateway } from "../src/tool-gateway.js";
import { generateToolManifest } from "../src/tool-codegen.js";

// Build a real stack: contract -> manifest -> gateway -> MCP server.
function buildStack(overrides = {}) {
  const booking = {
    id: "booking",
    rpc: [
      { method: "getAvailability", scope: "booking.read", public: false },
      { method: "createBooking", scope: "booking.write", public: false },
    ],
  };
  const manifest = generateToolManifest(booking);
  const auditLog = [];
  const calls = [];
  const gateway = createToolGateway({
    manifest,
    handlers: {
      booking_getAvailability: async () => { calls.push("avail"); return { slots: ["09:00", "10:00"] }; },
      booking_createBooking: async (input) => { calls.push("create"); return { id: "bk_1", ...input }; },
    },
    authorize: async (ctx, scope) => (ctx?.scopes ?? []).includes(scope),
    audit: { record: async (e) => auditLog.push(e) },
    now: () => 1000,
  });
  const server = createMcpToolServer({ gateway, schemas: overrides.schemas });
  return { server, auditLog, calls };
}

describe("createMcpToolServer — guards", () => {
  it("requires a gateway", () => {
    expect(() => createMcpToolServer({})).toThrow(/gateway/);
  });
});

describe("tools/list", () => {
  it("returns MCP tool defs with description, inputSchema, and governance _meta", () => {
    const { server } = buildStack();
    const list = server.toolDefinitions({ scopes: ["booking.read", "booking.write"] });
    expect(list.map((t) => t.name)).toEqual(["booking_getAvailability", "booking_createBooking"]);
    const mutationDef = list.find((t) => t.name === "booking_createBooking");
    expect(mutationDef._meta).toMatchObject({ mutation: true, requiresConfirmation: true, scope: "booking.write" });
    expect(mutationDef.inputSchema).toEqual({ type: "object", additionalProperties: true }); // permissive default
    expect(typeof mutationDef.description).toBe("string");
  });

  it("uses an injected per-tool inputSchema when provided", () => {
    const schema = { type: "object", properties: { date: { type: "string" } }, required: ["date"] };
    const { server } = buildStack({ schemas: { booking_getAvailability: schema } });
    const def = server.toolDefinitions().find((t) => t.name === "booking_getAvailability");
    expect(def.inputSchema).toBe(schema);
  });

  it("scope-filters the listed tools", () => {
    const { server } = buildStack();
    const visible = server.toolDefinitions({ scopes: ["booking.read"] }).map((t) => t.name);
    expect(visible).toEqual(["booking_getAvailability"]); // write tool hidden
  });
});

describe("tools/call — governance translated to MCP results", () => {
  const agent = { actor: "agent:concierge", scopes: ["booking.read", "booking.write"] };

  it("success -> content text, not an error", async () => {
    const { server } = buildStack();
    const r = await server.callTool("booking_getAvailability", { date: "2026-07-01" }, agent);
    expect(r.isError).toBe(false);
    expect(JSON.parse(r.content[0].text)).toEqual({ slots: ["09:00", "10:00"] });
  });

  it("scope denial -> isError with the FORBIDDEN code", async () => {
    const { server } = buildStack();
    const r = await server.callTool("booking_getAvailability", {}, { scopes: [] });
    expect(r.isError).toBe(true);
    expect(r._meta).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("mutation without confirmation -> isError + _meta.awaitingConfirmation (host can prompt)", async () => {
    const { server, calls } = buildStack();
    const r = await server.callTool("booking_createBooking", { slot: "09:00" }, agent);
    expect(r.isError).toBe(true);
    expect(r._meta).toMatchObject({ awaitingConfirmation: true, status: 202, tool: "booking_createBooking" });
    expect(calls).toEqual([]); // gated — not executed
  });

  it("unknown tool -> isError 404", async () => {
    const { server } = buildStack();
    const r = await server.callTool("booking_nope", {}, agent);
    expect(r.isError).toBe(true);
    expect(r._meta).toMatchObject({ status: 404, code: "UNKNOWN_TOOL" });
  });
});

describe("handleRequest — MCP method routing", () => {
  it("routes tools/list and tools/call; throws on an unsupported method", async () => {
    const { server } = buildStack();
    const listed = await server.handleRequest({ method: "tools/list" }, { scopes: ["booking.read"] });
    expect(listed.tools.map((t) => t.name)).toEqual(["booking_getAvailability"]);

    const called = await server.handleRequest(
      { method: "tools/call", params: { name: "booking_getAvailability", arguments: {} } },
      { scopes: ["booking.read"] }
    );
    expect(called.isError).toBe(false);

    await expect(server.handleRequest({ method: "resources/list" }, {})).rejects.toThrow(/unsupported/);
  });
});

describe("generateMcpServerEntry", () => {
  it("emits a stdio bootstrap wired to the gateway, with the confirm→gate mapping", () => {
    const src = generateMcpServerEntry({ id: "studio-booking" });
    expect(src.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(src).toContain('from "@modelcontextprotocol/sdk/server/stdio.js"');
    expect(src).toContain("ListToolsRequestSchema");
    expect(src).toContain("CallToolRequestSchema");
    expect(src).toContain("createToolGateway");
    expect(src).toContain("createMcpToolServer");
    expect(src).toContain("confirmed: confirm === true"); // the approval-gate mapping
    expect(src).toContain('name: "studio-booking-tools"');
    expect(src).toContain('from "./mcp-wiring.js"');
  });
  it("honors a custom server name and wiring module path", () => {
    const src = generateMcpServerEntry({ id: "x", name: "acme-mcp", wiringModule: "./wire.js" });
    expect(src).toContain('name: "acme-mcp"');
    expect(src).toContain('from "./wire.js"');
  });
});

describe("end-to-end demo over the MCP wire", () => {
  it("agent lists tools, reads freely, is gated on the mutation, then succeeds confirmed — all audited", async () => {
    const { server, auditLog, calls } = buildStack();
    const agent = { actor: "agent:concierge", scopes: ["booking.read", "booking.write"] };

    const list = await server.handleRequest({ method: "tools/list" }, agent);
    expect(list.tools).toHaveLength(2);

    const read = await server.handleRequest(
      { method: "tools/call", params: { name: "booking_getAvailability", arguments: { date: "2026-07-01" } } },
      agent
    );
    expect(read.isError).toBe(false);

    const gated = await server.handleRequest(
      { method: "tools/call", params: { name: "booking_createBooking", arguments: { slot: "09:00" } } },
      agent
    );
    expect(gated._meta.awaitingConfirmation).toBe(true);

    const confirmed = await server.handleRequest(
      { method: "tools/call", params: { name: "booking_createBooking", arguments: { slot: "09:00" } } },
      { ...agent, confirmed: true }
    );
    expect(confirmed.isError).toBe(false);
    expect(JSON.parse(confirmed.content[0].text)).toMatchObject({ id: "bk_1", slot: "09:00" });

    expect(calls).toEqual(["avail", "create"]); // booking created exactly once
    expect(auditLog.map((e) => `${e.tool}:${e.outcome}`)).toEqual([
      "booking_getAvailability:executed",
      "booking_createBooking:awaiting_confirmation",
      "booking_createBooking:executed",
    ]);
  });
});
