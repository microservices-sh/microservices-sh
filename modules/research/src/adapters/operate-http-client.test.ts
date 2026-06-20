import { describe, expect, it } from "vitest";
import { createOperateHttpClient } from "./operate-http-client";

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: any }> = [];
  const fetchImpl = async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return body;
      }
    } as Response;
  };
  return { fetchImpl, calls };
}

describe("createOperateHttpClient", () => {
  it("calls the operate API with the service token and owner scope, mapping records", async () => {
    const { fetchImpl, calls } = fakeFetch(200, {
      records: [
        { module: "invoice", entityId: "inv_42", asOf: 1_750_000_000_000, label: "Invoice inv_42", text: "overdue", fields: { status: "overdue" } }
      ]
    });
    const client = createOperateHttpClient({ baseUrl: "https://api.example.test", serviceToken: "svc-tok", fetch: fetchImpl });

    const records = await client.read({ tool: "ops.invoice.read", args: { customer: "ACME" } }, { ownerId: "owner_1" });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ module: "invoice", entityId: "inv_42" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.example.test/ops/ops.invoice.read");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.authorization).toBe("Bearer svc-tok");
    expect(calls[0].init.headers["x-owner-id"]).toBe("owner_1");
    expect(JSON.parse(calls[0].init.body)).toEqual({ args: { customer: "ACME" } });
  });

  it("throws with the status on a non-2xx operate response", async () => {
    const { fetchImpl } = fakeFetch(403, { error: "forbidden" });
    const client = createOperateHttpClient({ baseUrl: "https://api.example.test", serviceToken: "svc-tok", fetch: fetchImpl });
    await expect(client.read({ tool: "ops.invoice.read", args: {} }, { ownerId: "owner_1" })).rejects.toThrow(/403/);
  });

  it("tolerates a response with no records array", async () => {
    const { fetchImpl } = fakeFetch(200, {});
    const client = createOperateHttpClient({ baseUrl: "https://api.example.test", serviceToken: "svc-tok", fetch: fetchImpl });
    const records = await client.read({ tool: "ops.booking.read", args: {} }, { ownerId: "owner_1" });
    expect(records).toEqual([]);
  });
});
