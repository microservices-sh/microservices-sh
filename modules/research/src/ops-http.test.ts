import { describe, expect, it } from "vitest";
import type { OpsRecord } from "./ops";
import { type OpsServerRegistry, type OpsTokenVerifier } from "./ops-server";
import { createOpsHandler } from "./ops-http";

const invoiceRecord: OpsRecord = { module: "invoice", entityId: "inv_42", asOf: 1, label: "Invoice inv_42", text: "overdue" };

const registry: OpsServerRegistry = {
  "ops.invoice.read": { scope: "ops.invoice.read", async handler() { return [invoiceRecord]; } }
};
const verifier: OpsTokenVerifier = {
  async verify(token) {
    return token === "good" ? { ok: true, ownerId: "owner_1", scopes: ["ops.invoice.read"] } : { ok: false };
  }
};

function opsRequest(tool: string, init: { token?: string; owner?: string; body?: string; method?: string }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.owner) headers["x-owner-id"] = init.owner;
  const method = init.method ?? "POST";
  return new Request(`https://acme-app.example/ops/${tool}`, {
    method,
    headers,
    // GET/HEAD requests cannot carry a body (Fetch spec).
    ...(method === "GET" || method === "HEAD" ? {} : { body: init.body ?? JSON.stringify({ args: {} }) })
  });
}

describe("createOpsHandler (Fetch adapter)", () => {
  const handler = createOpsHandler({ registry, verifier });

  it("serves an authorized read as a 200 JSON response", async () => {
    const res = await handler(opsRequest("ops.invoice.read", { token: "good", owner: "owner_1", body: JSON.stringify({ args: { customer: "ACME" } }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.records).toEqual([invoiceRecord]);
  });

  it("maps a bad token to 401", async () => {
    const res = await handler(opsRequest("ops.invoice.read", { token: "nope" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("OPS_UNAUTHENTICATED");
  });

  it("maps a cross-tenant owner header to 403", async () => {
    const res = await handler(opsRequest("ops.invoice.read", { token: "good", owner: "owner_2" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("OPS_OWNER_MISMATCH");
  });

  it("rejects a non-POST method with 405", async () => {
    const res = await handler(opsRequest("ops.invoice.read", { token: "good", method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("returns 400 on an unparseable body", async () => {
    const res = await handler(opsRequest("ops.invoice.read", { token: "good", body: "{not json" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("OPS_BAD_REQUEST");
  });
});
