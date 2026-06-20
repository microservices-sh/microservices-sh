// Fetch-standard mount for the operations read-back (Plan 32, P1). The client's
// deployed operate app mounts this at `POST /ops/:tool` in one line:
//
//   const ops = createOpsHandler({ registry, verifier });
//   // Worker:   if (url.pathname.startsWith("/ops/")) return ops(request);
//   // SvelteKit: export const POST = ({ request }) => ops(request);
//
// It is the thin HTTP boundary over `handleOpsRequest` (the trust boundary):
// parse tool/token/owner/args from the Request, delegate, encode the Response.
// Cross-module wiring (a gateway-backed verifier, per-module read handlers) is
// assembled by the app — the composition root — and injected here.

import { handleOpsRequest, type OpsServerRegistry, type OpsTokenVerifier } from "./ops-server";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function createOpsHandler(deps: { registry: OpsServerRegistry; verifier: OpsTokenVerifier }) {
  return async function opsHandler(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json(405, { error: { code: "OPS_METHOD_NOT_ALLOWED", message: "Use POST." } });
    }

    const tool = new URL(request.url).pathname.split("/ops/")[1]?.split("/")[0] ?? "";
    const auth = request.headers.get("authorization") ?? "";
    const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1] ?? null;
    const ownerHeader = request.headers.get("x-owner-id");

    let args: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && "args" in parsed && typeof (parsed as any).args === "object") {
        args = (parsed as { args: Record<string, unknown> }).args ?? {};
      }
    } catch {
      return json(400, { error: { code: "OPS_BAD_REQUEST", message: "Body must be JSON { args }." } });
    }

    const result = await handleOpsRequest({ tool, token, ownerHeader, args }, deps);
    return json(result.status, result.body);
  };
}
