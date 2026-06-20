// Operations-plane retrieval (Plan 32, P1). Turns governed, owner-scoped LIVE
// reads of the operate plane (booking/customer/invoice/ticket/calendar — which
// live on Cloudflare D1, unreachable from the Fly agent's disk) into cited
// Passages, so operational facts flow through the same cite-or-refuse synthesis
// path as graph knowledge. Fail-closed: a tool not in the registry or a missing
// scope is refused WITHOUT calling the transport, and the denial is audited.
//
// Transport is injected (OpsClient): prod = HTTPS/MCP to the operate API with a
// per-tenant scoped service token; tests = a fake. This module owns governance +
// citation shape, not the wire.

import type { Actor, AuditSink } from "./index";
import type { Passage } from "./graph";

// A live operate-plane record. `asOf` is the freshness stamp surfaced in the
// citation so a brief can say "per live invoice (as of …)".
export type OpsRecord = {
  module: string;
  entityId: string;
  asOf: number;
  label: string;
  text: string;
  fields?: Record<string, unknown>;
};

export type OpsToolCall = { tool: string; args: Record<string, unknown> };

export interface OpsClient {
  read(call: OpsToolCall, scope: { ownerId: string; admin?: boolean }): Promise<OpsRecord[]>;
}

// Allow-list of read tools → the scope it requires + the operate module it hits.
// Anything not listed is refused (least privilege; clean audit).
export type OpsToolRegistry = Record<string, { scope: string; module: string }>;

export const DEFAULT_OPS_TOOLS: OpsToolRegistry = {
  "ops.customer.read": { scope: "ops.customer.read", module: "customer" },
  "ops.invoice.read": { scope: "ops.invoice.read", module: "invoice" },
  "ops.booking.read": { scope: "ops.booking.read", module: "booking" },
  "ops.ticket.read": { scope: "ops.support_ticket.read", module: "support-ticket" },
  "ops.calendar.read": { scope: "ops.calendar.read", module: "calendar-google" }
};

const ADMIN_SCOPE = "ops.admin";

function toPassage(record: OpsRecord, score: number): Passage {
  return {
    sourceFile: `${record.module}:${record.entityId}`, // citation = the live record ref
    sourceLocation: `as-of ${new Date(record.asOf).toISOString()}`,
    label: record.label,
    score,
    text: record.text
  };
}

export async function opsRead(
  input: OpsToolCall,
  deps: { client: OpsClient; actor: Actor; now: () => number; registry?: OpsToolRegistry; audit?: AuditSink }
) {
  const registry = deps.registry ?? DEFAULT_OPS_TOOLS;
  const actorId = deps.actor?.id ?? "anonymous";

  const denied = async (code: string, status: 401 | 403, message: string) => {
    await deps.audit?.record({ action: "ops.read_denied", actorId, entityType: "ops_tool", entityId: input.tool });
    return { ok: false as const, status, error: { code, message } };
  };

  if (!deps.actor) return denied("OPS_UNAUTHENTICATED", 401, "Actor required.");

  const tool = registry[input.tool];
  if (!tool) return denied("OPS_TOOL_UNKNOWN", 403, `Unknown ops tool ${input.tool}.`);

  const admin = deps.actor.scopes.includes(ADMIN_SCOPE);
  if (!admin && !deps.actor.scopes.includes(tool.scope)) {
    return denied("OPS_FORBIDDEN", 403, `Requires scope ${tool.scope}.`);
  }

  const records = await deps.client.read(input, { ownerId: deps.actor.id, admin });

  for (const record of records) {
    await deps.audit?.record({ action: "ops.read", actorId, entityType: record.module, entityId: record.entityId });
  }

  const passages = records.map((record) => toPassage(record, 1));
  return { ok: true as const, status: 200 as const, data: { passages, records } };
}
