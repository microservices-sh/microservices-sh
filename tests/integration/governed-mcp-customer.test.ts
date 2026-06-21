// Runnable governed-agent MCP demo, end to end against REAL module code.
//
// Wires the customer module's actual rpcContract (its real use cases) + a memory
// repository + the real audit-log module through the agentic keystone
// (tool-codegen → tool-gateway → mcp-tool-server), then drives the MCP wire as an
// agent would: list tools, read freely, hit the approval gate on a write, retry
// confirmed, and verify the write landed and every step is in the audit log.
//
// This is the wiring a generated app's `mcp-wiring.js` performs; here it runs
// against memory adapters so it is fully runnable with no managed runtime.

import { describe, it, expect } from "vitest";

import {
  generateToolManifest,
  createToolGateway,
  createMcpToolServer,
} from "../../packages/sdk-internal/src/index.js";

// Imported by relative path to the module sources (vitest transforms the TS);
// not every module is linked into node_modules, so this is the reliable path and
// is exactly what a generated app's wiring would import from its module packages.
import { rpcContract } from "../../modules/customer/src/rpc";
import { createMemoryCustomerRepository } from "../../modules/customer/src/adapters/memory-customer-repository";
import { recordEvent } from "../../modules/audit-log/src/use-cases/record-event";
import { createMemoryAuditEventStore } from "../../modules/audit-log/src/adapters/memory-audit-store";

function buildGovernedMcp() {
  // 1. Manifest from the module's real rpc contract.
  const customerModule = {
    id: "customer",
    rpc: Object.entries(rpcContract).map(([method, def]: [string, any]) => ({
      method,
      scope: def.scope,
      public: def.public,
    })),
  };
  const manifest = generateToolManifest(customerModule);

  // 2. Handlers = the module's real use-case handlers, bound to memory deps.
  const customerRepository = createMemoryCustomerRepository();
  const handlers = Object.fromEntries(
    Object.entries(rpcContract).map(([method, def]: [string, any]) => [
      `customer_${method}`,
      (input: unknown) => def.handler(input, { customerRepository }),
    ])
  );

  // 3. Audit sink = the real audit-log module use case over a memory store.
  const auditStore = createMemoryAuditEventStore();
  const audit = {
    record: (e: any) =>
      recordEvent(
        {
          eventName: `tool.${e.outcome}`,
          actorId: e.actor ?? "system",
          entityType: "tool",
          entityId: e.tool,
          source: "agent-mcp",
          payload: { method: e.method, module: e.module, mutation: e.mutation },
        },
        { auditStore }
      ),
  };

  // 4. Scope check from the actor's granted scopes.
  const authorize = (ctx: any, scope: string) => (ctx?.scopes ?? []).includes(scope);

  const gateway = createToolGateway({ manifest, handlers, authorize, audit });
  const mcp = createMcpToolServer({ gateway });
  return { mcp, auditStore };
}

async function auditEventNames(auditStore: any): Promise<string[]> {
  const out = await auditStore.list({});
  const rows = Array.isArray(out) ? out : (out?.events ?? out?.data?.events ?? []);
  return rows.map((r: any) => r.eventName);
}

describe("governed-agent MCP demo (real customer + audit-log modules)", () => {
  it("lists tools, reads freely, gates the write, executes on confirm, audits every step", async () => {
    const { mcp, auditStore } = buildGovernedMcp();
    const agent = { actor: "agent:crm", scopes: ["customer.read", "customer.write"] };

    // tools/list — the three customer tools, with governance metadata.
    const list: any = await mcp.handleRequest({ method: "tools/list" }, agent);
    expect(list.tools.map((t: any) => t.name).sort()).toEqual([
      "customer_getCustomer",
      "customer_listCustomers",
      "customer_upsertCustomer",
    ]);
    expect(list.tools.find((t: any) => t.name === "customer_upsertCustomer")._meta).toMatchObject({
      mutation: true,
      requiresConfirmation: true,
      scope: "customer.write",
    });

    // Read flows without confirmation.
    const before: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "customer_listCustomers", arguments: {} } },
      agent
    );
    expect(before.isError).toBe(false);
    expect(JSON.parse(before.content[0].text).ok).toBe(true);

    // Write is HELD at the approval gate — no customer is created.
    const gated: any = await mcp.handleRequest(
      {
        method: "tools/call",
        params: { name: "customer_upsertCustomer", arguments: { name: "Ann Lee", email: "ann@example.com" } },
      },
      agent
    );
    expect(gated.isError).toBe(true);
    expect(gated._meta).toMatchObject({ awaitingConfirmation: true, status: 202 });

    // Confirmed — the real use case runs and creates the customer.
    const confirmed: any = await mcp.handleRequest(
      {
        method: "tools/call",
        params: { name: "customer_upsertCustomer", arguments: { name: "Ann Lee", email: "ann@example.com", confirm: true } },
      },
      { ...agent, confirmed: true }
    );
    expect(confirmed.isError).toBe(false);
    expect(JSON.parse(confirmed.content[0].text).ok).toBe(true);

    // Read back — the write really landed in the module's repository.
    const after: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "customer_listCustomers", arguments: {} } },
      agent
    );
    expect(after.content[0].text).toContain("ann@example.com");

    // A scoped read by an actor WITHOUT the scope is denied (and not run).
    const denied: any = await mcp.handleRequest(
      { method: "tools/call", params: { name: "customer_getCustomer", arguments: { id: "x" } } },
      { actor: "agent:nobody", scopes: [] }
    );
    expect(denied.isError).toBe(true);
    expect(denied._meta).toMatchObject({ code: "FORBIDDEN", status: 403 });

    // Every governed step landed in the real audit log. The store doesn't
    // guarantee read order (events share a millisecond), so assert the multiset:
    // 3 executions (two reads + the confirmed write), one gate, one denial.
    const names = await auditEventNames(auditStore);
    const count = (name: string) => names.filter((n) => n === name).length;
    expect(names).toHaveLength(5);
    expect(count("tool.executed")).toBe(3);
    expect(count("tool.awaiting_confirmation")).toBe(1);
    expect(count("tool.denied")).toBe(1);
  });
});
