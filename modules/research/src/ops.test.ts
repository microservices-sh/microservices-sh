import { describe, expect, it } from "vitest";
import { type OpsClient, type OpsRecord, opsRead } from "./ops";

const NOW = 1_750_000_000_000; // fixed epoch for deterministic as-of
const now = () => NOW;

function fakeClient(records: OpsRecord[]) {
  const calls: Array<{ tool: string; args: Record<string, unknown>; scope: { ownerId: string } }> = [];
  const client: OpsClient = {
    async read(call, scope) {
      calls.push({ ...call, scope });
      return records;
    }
  };
  return { client, calls };
}

function auditSpy() {
  const entries: Array<{ action: string; actorId: string; entityType: string; entityId: string }> = [];
  return { sink: { async record(e: any) { entries.push(e); } }, entries };
}

const actor = { id: "owner_1", scopes: ["ops.invoice.read"] };

const invoiceRecord: OpsRecord = {
  module: "invoice",
  entityId: "inv_42",
  asOf: NOW,
  label: "Invoice inv_42 — ACME — $1,200 — overdue",
  text: "Invoice inv_42 for ACME Corp, amount $1,200, status overdue, due 2026-06-01.",
  fields: { amount: 1200, status: "overdue" }
};

describe("opsRead", () => {
  it("reads an authorized tool and returns cited passages tagged with as-of freshness", async () => {
    const { client, calls } = fakeClient([invoiceRecord]);
    const result = await opsRead(
      { tool: "ops.invoice.read", args: { customer: "ACME" } },
      { client, actor, now }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");

    // transport called once, owner-scoped to the actor.
    expect(calls).toHaveLength(1);
    expect(calls[0].scope.ownerId).toBe("owner_1");
    expect(calls[0].tool).toBe("ops.invoice.read");

    const [passage] = result.data.passages;
    expect(passage.sourceFile).toBe("invoice:inv_42"); // citation = the live record ref
    expect(passage.sourceLocation).toBe(`as-of ${new Date(NOW).toISOString()}`);
    expect(passage.text).toContain("overdue");
  });

  it("refuses an unknown tool without calling the transport (fail-closed) and audits the denial", async () => {
    const { client, calls } = fakeClient([invoiceRecord]);
    const audit = auditSpy();
    const result = await opsRead(
      { tool: "ops.payroll.read", args: {} },
      { client, actor: { id: "owner_1", scopes: ["ops.payroll.read"] }, now, audit: audit.sink }
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("OPS_TOOL_UNKNOWN");
    expect(calls).toHaveLength(0);
    expect(audit.entries.at(-1)).toMatchObject({ action: "ops.read_denied", actorId: "owner_1" });
  });

  it("refuses when the actor lacks the tool's scope, without calling the transport", async () => {
    const { client, calls } = fakeClient([invoiceRecord]);
    const audit = auditSpy();
    const result = await opsRead(
      { tool: "ops.invoice.read", args: {} },
      { client, actor: { id: "owner_1", scopes: [] }, now, audit: audit.sink }
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("OPS_FORBIDDEN");
    expect(result.error.message).toContain("ops.invoice.read");
    expect(calls).toHaveLength(0);
    expect(audit.entries.at(-1)).toMatchObject({ action: "ops.read_denied" });
  });

  it("audits a successful read", async () => {
    const { client } = fakeClient([invoiceRecord]);
    const audit = auditSpy();
    await opsRead({ tool: "ops.invoice.read", args: {} }, { client, actor, now, audit: audit.sink });
    expect(audit.entries.at(-1)).toMatchObject({ action: "ops.read", actorId: "owner_1", entityType: "invoice", entityId: "inv_42" });
  });

  it("returns ok with empty passages when there are no records (caller applies cite-or-refuse)", async () => {
    const { client } = fakeClient([]);
    const result = await opsRead({ tool: "ops.invoice.read", args: {} }, { client, actor, now });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.passages).toEqual([]);
  });
});
