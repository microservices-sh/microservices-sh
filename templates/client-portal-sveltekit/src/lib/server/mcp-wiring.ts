// MCP server wiring for the client-portal app — the EDIT SEAM the generated stdio
// server (generated/mcp-server.mjs) imports. Governance (scope gating, approval
// on mutations, audit) lives in the generated tool-manifest + the sdk tool
// gateway; this file only binds each governed tool to its module use-case,
// supplies the audit sink, and resolves the calling agent's actor + scopes.
//
// Deps are bound ONCE at process start (a stdio server has no per-request
// platform binding). Memory adapters by default so it runs locally with
//   npm run mcp
// Swap each store for its D1/R2 adapter when serving a real backend.

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

import { rpcContract as customerRpc } from "@microservices-sh/customer/rpc";
import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";

import { createUploadTicket, completeUpload, listFiles, deleteFile } from "@microservices-sh/file-media";
import { createMemoryMediaStore } from "@microservices-sh/file-media/adapters/memory";
import { createMemoryObjectStorage } from "@microservices-sh/file-media/adapters/memory-storage";

import { recordEvent } from "@microservices-sh/audit-log";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";

// --- module deps, one set for the process lifetime ---------------------------
const signingKeyStore = createMemorySigningKeyStore();
const identityDeps = {
  accountStore: createMemoryAccountStore(),
  loginCodeStore: createMemoryLoginCodeStore(),
  sessionStore: createMemorySessionStore(),
};
const customerRepository = createMemoryCustomerRepository();
const fileMediaDeps = { mediaStore: createMemoryMediaStore(), storage: createMemoryObjectStorage() };
const auditStore = createMemoryAuditEventStore();

// --- the seam exports the generated entry imports (manifest comes from the
// generated tool-manifest, not from here) -------------------------------------

export const schemas: Record<string, unknown> = {};

export const handlers: Record<string, (input: unknown) => Promise<unknown>> = {
  auth_mintToken: (input) => authRpc.mintToken.handler(input, { signingKeyStore }),
  auth_verifyToken: (input) => authRpc.verifyToken.handler(input, { signingKeyStore }),
  auth_getJwks: (input) => authRpc.getJwks.handler(input, { signingKeyStore }),
  identity_requestLoginCode: (input) => requestLoginCode(input, identityDeps),
  identity_verifyLoginCode: (input) => verifyLoginCode(input, identityDeps),
  identity_readSession: (input) => readSession(input as { sessionId?: string | null }, identityDeps),
  identity_destroySession: (input) => destroySession(input as { sessionId?: string }, identityDeps),
  customer_getCustomer: (input) => customerRpc.getCustomer.handler(input, { customerRepository }),
  customer_listCustomers: (input) => customerRpc.listCustomers.handler(input, { customerRepository }),
  customer_upsertCustomer: (input) => customerRpc.upsertCustomer.handler(input, { customerRepository }),
  "file-media_createUploadTicket": (input) => createUploadTicket(input, fileMediaDeps),
  "file-media_completeUpload": (input) => completeUpload(input, fileMediaDeps),
  "file-media_listFiles": (input) => listFiles(input, fileMediaDeps),
  "file-media_deleteFile": (input) => deleteFile(input, fileMediaDeps),
};

// Scope check: the agent's granted scopes must include the tool's required scope.
export function authorize(ctx: { scopes?: string[] } | undefined, scope: string | null): boolean {
  if (!scope) return true;
  return (ctx?.scopes ?? []).includes(scope);
}

// Audit sink — every governed outcome is appended to the real audit-log module.
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

// The calling agent's identity + granted scopes for this stdio session, from env.
export function actorContext(): { actor: string; scopes: string[] } {
  const scopes = (process.env.MCP_AGENT_SCOPES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { actor: process.env.MCP_AGENT_ID ?? "agent:client-portal", scopes };
}
