// Operate-plane server handler (Plan 32, P1). Mounted by the client's deployed
// operate app — the app that actually holds the operational D1. It receives the
// Hermes agent's read-back call and is the TRUST BOUNDARY:
//
//   • the inbound service token is verified → the tenant owner it is bound to;
//   • that token-bound ownerId — never a client-supplied value — scopes the read;
//   • an X-Owner-Id that disagrees with the token is rejected (no cross-tenant read);
//   • the token must carry the tool's scope (least privilege).
//
// Each tool maps to a module read use-case via an injected handler, so this file
// owns governance, not any module's storage shape.

import type { OpsRecord } from "./ops";

export type OpsToolHandler = (args: Record<string, unknown>, scope: { ownerId: string }) => Promise<OpsRecord[]>;
export type OpsServerTool = { scope: string; handler: OpsToolHandler };
export type OpsServerRegistry = Record<string, OpsServerTool>;

export interface OpsTokenVerifier {
  verify(token: string): Promise<{ ok: true; ownerId: string; scopes: string[] } | { ok: false }>;
}

type OpsResponse = { status: number; body: { records: OpsRecord[] } | { error: { code: string; message: string } } };

const err = (status: number, code: string, message: string): OpsResponse => ({ status, body: { error: { code, message } } });

export async function handleOpsRequest(
  req: { tool: string; token: string | null; ownerHeader: string | null; args: Record<string, unknown> },
  deps: { registry: OpsServerRegistry; verifier: OpsTokenVerifier }
): Promise<OpsResponse> {
  if (!req.token) return err(401, "OPS_UNAUTHENTICATED", "Service token required.");

  const auth = await deps.verifier.verify(req.token);
  if (!auth.ok) return err(401, "OPS_UNAUTHENTICATED", "Invalid service token.");

  const tool = deps.registry[req.tool];
  if (!tool) return err(404, "OPS_TOOL_UNKNOWN", `Unknown ops tool ${req.tool}.`);

  if (!auth.scopes.includes(tool.scope)) return err(403, "OPS_FORBIDDEN", `Token lacks scope ${tool.scope}.`);

  // Owner scope is the token's binding. A header may restate it but must agree;
  // it can never widen access to another tenant's owner.
  if (req.ownerHeader && req.ownerHeader !== auth.ownerId) {
    return err(403, "OPS_OWNER_MISMATCH", "X-Owner-Id does not match the authenticated tenant.");
  }

  const records = await tool.handler(req.args, { ownerId: auth.ownerId });
  return { status: 200, body: { records } };
}
