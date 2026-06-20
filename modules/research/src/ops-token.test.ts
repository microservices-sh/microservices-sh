import { describe, expect, it } from "vitest";
import { createOpsTokenVerifier, mintOpsToken } from "./ops-token";
import { type OpsServerRegistry, handleOpsRequest } from "./ops-server";
import type { OpsRecord } from "./ops";

const SECRET = "tenant-shared-secret-acme";
const NOW = 1_750_000_000_000;

describe("ops token mint + verify (per-tenant scoped service token)", () => {
  it("mints a token the matching-secret verifier accepts, recovering owner + scopes", async () => {
    const token = await mintOpsToken({ ownerId: "owner_1", scopes: ["ops.invoice.read"], exp: NOW + 60_000 }, { secret: SECRET });
    const verifier = createOpsTokenVerifier({ secret: SECRET, now: () => NOW });

    const result = await verifier.verify(token);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ownerId).toBe("owner_1");
    expect(result.scopes).toEqual(["ops.invoice.read"]);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await mintOpsToken({ ownerId: "owner_1", scopes: [], exp: NOW + 60_000 }, { secret: "other-secret" });
    const verifier = createOpsTokenVerifier({ secret: SECRET, now: () => NOW });
    expect((await verifier.verify(token)).ok).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const token = await mintOpsToken({ ownerId: "owner_1", scopes: ["ops.invoice.read"], exp: NOW + 60_000 }, { secret: SECRET });
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ownerId: "owner_2", scopes: ["ops.admin"], exp: NOW + 60_000 })).toString("base64url");
    const tampered = `${forged}.${sig}`;
    expect(payload).not.toBe(forged);
    const verifier = createOpsTokenVerifier({ secret: SECRET, now: () => NOW });
    expect((await verifier.verify(tampered)).ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await mintOpsToken({ ownerId: "owner_1", scopes: [], exp: NOW - 1 }, { secret: SECRET });
    const verifier = createOpsTokenVerifier({ secret: SECRET, now: () => NOW });
    expect((await verifier.verify(token)).ok).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const verifier = createOpsTokenVerifier({ secret: SECRET, now: () => NOW });
    expect((await verifier.verify("garbage")).ok).toBe(false);
    expect((await verifier.verify("")).ok).toBe(false);
  });

  it("a minted token authorizes a real ops read through handleOpsRequest", async () => {
    const record: OpsRecord = { module: "invoice", entityId: "inv_42", asOf: NOW, label: "Invoice inv_42", text: "overdue" };
    const registry: OpsServerRegistry = { "ops.invoice.read": { scope: "ops.invoice.read", async handler() { return [record]; } } };
    const verifier = createOpsTokenVerifier({ secret: SECRET, now: () => NOW });

    const token = await mintOpsToken({ ownerId: "owner_1", scopes: ["ops.invoice.read"], exp: NOW + 60_000 }, { secret: SECRET });
    const res = await handleOpsRequest({ tool: "ops.invoice.read", token, ownerHeader: "owner_1", args: {} }, { registry, verifier });

    expect(res.status).toBe(200);
    expect((res.body as any).records).toEqual([record]);
  });
});
