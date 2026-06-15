import { ok } from "@microservices-sh/connection-contract";
import { identityMeta } from "../meta";
import { SESSION_TTL_SECONDS } from "../config";
import type { AccountStore, SessionStore } from "../ports";
import type { IdentityUser } from "../types";

export interface ReadSessionDeps {
  sessionStore: SessionStore;
  accountStore: AccountStore;
  sessionTtlSeconds?: number;
  now?: () => number;
  correlationId?: string;
}

// Resolve a session id (from the cookie) to the current user, or null. Fails closed: an
// unknown, expired, or orphaned session resolves to null so the SSR /admin guard rejects.
// Rolling refresh extends an active session on use.
export async function readSession(input: { sessionId?: string | null }, deps: ReadSessionDeps) {
  const meta = identityMeta(deps);
  const sessionId = input?.sessionId ? String(input.sessionId) : "";
  if (!sessionId) return ok(200, { user: null as IdentityUser | null }, meta);

  const session = await deps.sessionStore.get(sessionId);
  const now = deps.now?.() ?? Date.now();
  if (!session || now > session.expiresAt) {
    return ok(200, { user: null as IdentityUser | null }, meta);
  }

  const account = await deps.accountStore.findById(session.userId);
  if (!account) return ok(200, { user: null as IdentityUser | null }, meta);

  await deps.sessionStore.touch(sessionId, now + (deps.sessionTtlSeconds ?? SESSION_TTL_SECONDS) * 1000);
  const user: IdentityUser = { id: account.id, email: account.email, isAdmin: account.isAdmin };
  return ok(200, { user }, meta);
}

export async function destroySession(
  input: { sessionId?: string | null },
  deps: { sessionStore: SessionStore; now?: () => number; correlationId?: string }
) {
  const meta = identityMeta(deps);
  if (input?.sessionId) await deps.sessionStore.delete(String(input.sessionId));
  return ok(200, { ended: true }, meta);
}
