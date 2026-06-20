import { describe, expect, it } from "vitest";
import type { OpsRecord } from "./ops";
import { type OpsServerRegistry, type OpsTokenVerifier, handleOpsRequest } from "./ops-server";

const invoiceRecord: OpsRecord = { module: "invoice", entityId: "inv_42", asOf: 1, label: "Invoice inv_42", text: "overdue" };

function registry(): { reg: OpsServerRegistry; seen: Array<{ args: any; ownerId: string }> } {
  const seen: Array<{ args: any; ownerId: string }> = [];
  const reg: OpsServerRegistry = {
    "ops.invoice.read": {
      scope: "ops.invoice.read",
      async handler(args, scope) {
        seen.push({ args, ownerId: scope.ownerId });
        return [invoiceRecord];
      }
    }
  };
  return { reg, seen };
}

// Token "good" → owner_1 with the invoice scope; anything else → invalid.
const verifier: OpsTokenVerifier = {
  async verify(token) {
    if (token === "good") return { ok: true, ownerId: "owner_1", scopes: ["ops.invoice.read"] };
    return { ok: false };
  }
};

describe("handleOpsRequest", () => {
  it("dispatches an authorized read scoped to the token's owner", async () => {
    const { reg, seen } = registry();
    const res = await handleOpsRequest(
      { tool: "ops.invoice.read", token: "good", ownerHeader: "owner_1", args: { customer: "ACME" } },
      { registry: reg, verifier }
    );
    expect(res.status).toBe(200);
    expect((res.body as any).records).toEqual([invoiceRecord]);
    // handler ran with the token's owner, not anything client-supplied.
    expect(seen).toEqual([{ args: { customer: "ACME" }, ownerId: "owner_1" }]);
  });

  it("rejects a missing or invalid token without dispatching", async () => {
    const { reg, seen } = registry();
    const res = await handleOpsRequest({ tool: "ops.invoice.read", token: null, ownerHeader: "owner_1", args: {} }, { registry: reg, verifier });
    expect(res.status).toBe(401);
    expect((res.body as any).error.code).toBe("OPS_UNAUTHENTICATED");
    expect(seen).toHaveLength(0);
  });

  it("rejects an unknown tool", async () => {
    const { reg } = registry();
    const res = await handleOpsRequest({ tool: "ops.payroll.read", token: "good", ownerHeader: "owner_1", args: {} }, { registry: reg, verifier });
    expect(res.status).toBe(404);
    expect((res.body as any).error.code).toBe("OPS_TOOL_UNKNOWN");
  });

  it("rejects when the token lacks the tool's scope", async () => {
    const { reg } = registry();
    const scopelessVerifier: OpsTokenVerifier = { async verify() { return { ok: true, ownerId: "owner_1", scopes: [] }; } };
    const res = await handleOpsRequest({ tool: "ops.invoice.read", token: "good", ownerHeader: "owner_1", args: {} }, { registry: reg, verifier: scopelessVerifier });
    expect(res.status).toBe(403);
    expect((res.body as any).error.code).toBe("OPS_FORBIDDEN");
  });

  it("rejects an X-Owner-Id that does not match the token's bound owner (no cross-tenant read)", async () => {
    const { reg, seen } = registry();
    const res = await handleOpsRequest({ tool: "ops.invoice.read", token: "good", ownerHeader: "owner_2", args: {} }, { registry: reg, verifier });
    expect(res.status).toBe(403);
    expect((res.body as any).error.code).toBe("OPS_OWNER_MISMATCH");
    expect(seen).toHaveLength(0);
  });

  it("defaults to the token's owner when no X-Owner-Id is supplied", async () => {
    const { reg, seen } = registry();
    const res = await handleOpsRequest({ tool: "ops.invoice.read", token: "good", ownerHeader: null, args: {} }, { registry: reg, verifier });
    expect(res.status).toBe(200);
    expect(seen[0].ownerId).toBe("owner_1");
  });
});
