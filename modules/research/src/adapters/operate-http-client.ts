import type { OpsClient, OpsRecord, OpsToolCall } from "../ops";

// Prod transport for the operations plane (Plan 32, P1). The Hermes agent runs
// on Fly and cannot read Cloudflare D1 directly, so it calls the operate API
// over HTTPS with a per-tenant scoped service token (a Fly secret). The operate
// plane enforces ownerId server-side — the X-Owner-Id header is the scope the
// token is bound to, not a trust boundary the agent sets freely.
//
// fetch is injected so this is testable without a network and works on any
// runtime (Workers/Node) that provides a fetch.

type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function createOperateHttpClient(config: {
  baseUrl: string;
  serviceToken: string;
  fetch: FetchLike;
}): OpsClient {
  const base = config.baseUrl.replace(/\/+$/, "");
  return {
    async read(call: OpsToolCall, scope: { ownerId: string; admin?: boolean }): Promise<OpsRecord[]> {
      const response = await config.fetch(`${base}/ops/${call.tool}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.serviceToken}`,
          "x-owner-id": scope.ownerId,
          "content-type": "application/json"
        },
        body: JSON.stringify({ args: call.args })
      });
      if (!response.ok) {
        throw new Error(`operate read ${call.tool} failed: HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { records?: OpsRecord[] };
      return Array.isArray(payload.records) ? payload.records : [];
    }
  };
}
