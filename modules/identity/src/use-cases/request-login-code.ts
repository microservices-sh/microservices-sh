import { ok, err } from "@microservices-sh/connection-contract";
import { identityMeta } from "../meta";
import { randomCode, sha256Hex } from "../crypto";
import { LOGIN_CODE_DIGITS, LOGIN_CODE_TTL_SECONDS } from "../config";
import type { AccountStore, LoginCodeStore } from "../ports";

export interface RequestLoginCodeDeps {
  accountStore: AccountStore;
  loginCodeStore: LoginCodeStore;
  // Emails matching this (lowercased) are provisioned as admins on first sight — the
  // bootstrap admin. Everything else is a normal user. Replace with an invite/role flow later.
  adminEmails?: string[];
  ttlSeconds?: number;
  now?: () => number;
  correlationId?: string;
}

// Step 1 of passwordless login. Find-or-create the account, mint a one-time code, store
// only its salted hash, and RETURN the plaintext code to the caller so it can be sent via
// the email module. The code is never logged or persisted in the clear.
export async function requestLoginCode(input: unknown, deps: RequestLoginCodeDeps) {
  const meta = identityMeta(deps);
  const email = String((input as { email?: unknown })?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return err(400, { code: "identity.INVALID_EMAIL", message: "A valid email is required." }, meta);
  }

  let account = await deps.accountStore.findByEmail(email);
  if (!account) {
    const isAdmin = (deps.adminEmails ?? []).map((e) => e.toLowerCase()).includes(email);
    account = await deps.accountStore.create({ email, isAdmin });
  }

  const code = randomCode(LOGIN_CODE_DIGITS);
  const ttl = (deps.ttlSeconds ?? LOGIN_CODE_TTL_SECONDS) * 1000;
  const now = deps.now?.() ?? Date.now();
  await deps.loginCodeStore.put({
    email,
    codeHash: await sha256Hex(`${email}:${code}`),
    expiresAt: now + ttl,
    attempts: 0,
    consumedAt: null,
  });

  // `code` is for the caller to hand to the email module — do not log it.
  return ok(200, { email, code, expiresInSeconds: deps.ttlSeconds ?? LOGIN_CODE_TTL_SECONDS }, meta);
}
