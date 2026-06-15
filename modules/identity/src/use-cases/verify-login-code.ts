import { ok, err } from "@microservices-sh/connection-contract";
import { identityMeta } from "../meta";
import { sha256Hex, constantTimeEqual } from "../crypto";
import { LOGIN_CODE_MAX_ATTEMPTS, SESSION_TTL_SECONDS } from "../config";
import type { AccountStore, LoginCodeStore, SessionStore } from "../ports";
import type { IdentityUser } from "../types";

export interface VerifyLoginCodeDeps {
  accountStore: AccountStore;
  loginCodeStore: LoginCodeStore;
  sessionStore: SessionStore;
  sessionTtlSeconds?: number;
  now?: () => number;
  correlationId?: string;
}

// Step 2 of passwordless login. Validate the code (exists, unconsumed, unexpired, under the
// attempt cap, hash matches in constant time); on success consume it single-use and open a
// server-side session. Returns the opaque sessionId for the caller to set as an httpOnly cookie.
export async function verifyLoginCode(input: unknown, deps: VerifyLoginCodeDeps) {
  const meta = identityMeta(deps);
  const email = String((input as { email?: unknown })?.email ?? "").trim().toLowerCase();
  const code = String((input as { code?: unknown })?.code ?? "").trim();
  if (!email || !code) {
    return err(400, { code: "identity.INVALID_INPUT", message: "Email and code are required." }, meta);
  }

  const record = await deps.loginCodeStore.getByEmail(email);
  const now = deps.now?.() ?? Date.now();
  if (!record || record.consumedAt !== null) {
    return err(401, { code: "identity.CODE_INVALID", message: "Invalid or already-used code." }, meta);
  }
  if (now > record.expiresAt) {
    return err(401, { code: "identity.CODE_EXPIRED", message: "The code has expired. Request a new one." }, meta);
  }
  if (record.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
    return err(429, { code: "identity.TOO_MANY_ATTEMPTS", message: "Too many attempts. Request a new code." }, meta);
  }

  const candidate = await sha256Hex(`${email}:${code}`);
  if (!constantTimeEqual(candidate, record.codeHash)) {
    await deps.loginCodeStore.update(email, { attempts: record.attempts + 1 });
    return err(401, { code: "identity.CODE_INVALID", message: "Invalid code." }, meta);
  }

  // Single-use: consume before issuing the session so a replay can't reuse it.
  await deps.loginCodeStore.update(email, { consumedAt: now });

  const account = await deps.accountStore.findByEmail(email);
  if (!account) {
    return err(404, { code: "identity.ACCOUNT_NOT_FOUND", message: "Account not found." }, meta);
  }

  const ttl = (deps.sessionTtlSeconds ?? SESSION_TTL_SECONDS) * 1000;
  const session = await deps.sessionStore.create({ userId: account.id, expiresAt: now + ttl });
  const user: IdentityUser = { id: account.id, email: account.email, isAdmin: account.isAdmin };
  return ok(200, { sessionId: session.id, user }, meta);
}
