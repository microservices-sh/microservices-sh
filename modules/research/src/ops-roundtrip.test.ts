import { describe, expect, it } from "vitest";
import { createOperateHttpClient } from "./adapters/operate-http-client";
import { opsRead, type OpsRecord } from "./ops";
import { type OpsServerRegistry, type OpsTokenVerifier, handleOpsRequest } from "./ops-server";

// End-to-end protocol contract: client (opsRead → operate-http-client) talks to
// the operate-plane server (handleOpsRequest) through a fetch that routes the
// HTTP request into the server. Catches any path/header/body drift between the
// two independently-written halves.

const invoiceRecord: OpsRecord = { module: "invoice", entityId: "inv_42", asOf: 1_750_000_000_000, label: "Invoice inv_42", text: "ACME overdue $1,200" };

const serverRegistry: OpsServerRegistry = {
  "ops.invoice.read": { scope: "ops.invoice.read", async handler() { return [invoiceRecord]; } }
};
const serverVerifier: OpsTokenVerifier = {
  async verify(token) {
    return token === "tenant-token" ? { ok: true, ownerId: "owner_1", scopes: ["ops.invoice.read"] } : { ok: false };
  }
};

// A fetch that decodes the client's request exactly as the operate app would,
// hands it to the server, and re-encodes the response.
function wiredFetch(registry: OpsServerRegistry, verifier: OpsTokenVerifier) {
  return async (url: string, init: any) => {
    const tool = url.split("/ops/")[1];
    const token = (init.headers.authorization ?? "").replace(/^Bearer\s+/, "") || null;
    const ownerHeader = init.headers["x-owner-id"] ?? null;
    const { args } = JSON.parse(init.body);
    const res = await handleOpsRequest({ tool, token, ownerHeader, args }, { registry, verifier });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, async json() { return res.body; } } as Response;
  };
}

describe("ops read-back round-trip (client ⇄ operate server)", () => {
  it("an authorized operational read flows through as a cited passage", async () => {
    const client = createOperateHttpClient({
      baseUrl: "https://acme-app.example",
      serviceToken: "tenant-token",
      fetch: wiredFetch(serverRegistry, serverVerifier)
    });
    const actor = { id: "owner_1", scopes: ["ops.invoice.read"] };

    const result = await opsRead({ tool: "ops.invoice.read", args: { customer: "ACME" } }, { client, actor, now: () => 1_750_000_000_000 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const [passage] = result.data.passages;
    expect(passage.sourceFile).toBe("invoice:inv_42");
    expect(passage.text).toContain("overdue");
  });

  it("a bad service token surfaces as a thrown transport error (server rejects)", async () => {
    const client = createOperateHttpClient({
      baseUrl: "https://acme-app.example",
      serviceToken: "wrong-token",
      fetch: wiredFetch(serverRegistry, serverVerifier)
    });
    const actor = { id: "owner_1", scopes: ["ops.invoice.read"] };
    await expect(opsRead({ tool: "ops.invoice.read", args: {} }, { client, actor, now: () => 1 })).rejects.toThrow(/401/);
  });
});
