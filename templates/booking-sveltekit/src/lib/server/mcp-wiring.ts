// MCP server wiring for the booking app — the EDIT SEAM the generated stdio
// server (generated/mcp-server.mjs) imports. Governance (scope gating, approval
// on mutations, audit) lives in the generated tool-manifest + the sdk tool
// gateway; this file only binds each governed tool to its module use-case,
// supplies the audit sink, and resolves the calling agent's actor + scopes.
//
// Deps are bound ONCE at process start (a stdio server has no per-request
// platform binding). Memory adapters by default so it runs locally with
//   npx tsx generated/mcp-server.mjs
// Swap each store for its D1 adapter (createD1*Store(env.DB)) — the same
// adapters the route handlers in this directory already use — when serving a
// real database.

import { rpcContract as authRpc } from "@microservices-sh/auth/rpc";
import { createMemorySigningKeyStore } from "@microservices-sh/auth/adapters/memory";

import {
  requestLoginCode,
  verifyLoginCode,
  readSession,
  destroySession,
} from "@microservices-sh/identity/service";
import {
  createMemoryAccountStore,
  createMemoryLoginCodeStore,
  createMemorySessionStore,
} from "@microservices-sh/identity/adapters/memory";

import { rpcContract as paymentRpc } from "@microservices-sh/payment/rpc";
import { createMemoryPaymentRepository } from "@microservices-sh/payment/adapters/memory";
import { createMemoryPaymentGateway } from "@microservices-sh/payment/adapters/memory-gateway";

import { recordEvent } from "@microservices-sh/audit-log";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";

// --- module deps, one set for the process lifetime ---------------------------
const signingKeyStore = createMemorySigningKeyStore();
const identityDeps = {
  accountStore: createMemoryAccountStore(),
  loginCodeStore: createMemoryLoginCodeStore(),
  sessionStore: createMemorySessionStore(),
};
const paymentDeps = {
  paymentRepository: createMemoryPaymentRepository(),
  paymentGateway: createMemoryPaymentGateway(),
};
const auditStore = createMemoryAuditEventStore();

// --- the seam exports the generated entry imports (manifest comes from the
// generated tool-manifest, not from here) -------------------------------------

// Per-tool JSON input schemas. Empty = permissive; the module's own zod schema
// still validates when the handler runs. Fill in to give agents tighter shapes.
export const schemas: Record<string, unknown> = {};

// One handler per governed tool, bound to its module use-case + deps. Tool names
// match the manifest (module_method).
export const handlers: Record<string, (input: unknown) => Promise<unknown>> = {
  auth_mintToken: (input) => authRpc.mintToken.handler(input, { signingKeyStore }),
  auth_verifyToken: (input) => authRpc.verifyToken.handler(input, { signingKeyStore }),
  auth_getJwks: (input) => authRpc.getJwks.handler(input, { signingKeyStore }),
  identity_requestLoginCode: (input) => requestLoginCode(input, identityDeps),
  identity_verifyLoginCode: (input) => verifyLoginCode(input, identityDeps),
  identity_readSession: (input) => readSession(input as { sessionId?: string | null }, identityDeps),
  identity_destroySession: (input) => destroySession(input as { sessionId?: string }, identityDeps),
  payment_createPaymentIntent: (input) => paymentRpc.createPaymentIntent.handler(input, paymentDeps),
};

// Scope check: the agent's granted scopes must include the tool's required scope.
// Public tools (scope null) pass regardless.
export function authorize(ctx: { scopes?: string[] } | undefined, scope: string | null): boolean {
  if (!scope) return true;
  return (ctx?.scopes ?? []).includes(scope);
}

// Audit sink — every governed outcome (executed / denied / awaiting_confirmation
// / error) is appended to the real audit-log module.
export const audit = {
  record: (e: {
    tool: string;
    outcome: string;
    actor?: string;
    method?: string;
    module?: string;
    mutation?: boolean;
  }) =>
    recordEvent(
      {
        eventName: `tool.${e.outcome}`,
        actorId: e.actor ?? "agent",
        entityType: "tool",
        entityId: e.tool,
        source: "agent-mcp",
        payload: { method: e.method, module: e.module, mutation: e.mutation },
      },
      { auditStore },
    ),
};

// The calling agent's identity + granted scopes for this stdio session. A real
// deployment derives these from the MCP client's credential; locally they come
// from env so you can scope a session without code changes.
export function actorContext(): { actor: string; scopes: string[] } {
  const scopes = (process.env.MCP_AGENT_SCOPES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { actor: process.env.MCP_AGENT_ID ?? "agent:booking", scopes };
}
