import { ok, err } from "@microservices-sh/connection-contract";
import { passkeyMeta } from "../meta";
import { CHALLENGE_TTL_SECONDS } from "../config";
import type { PasskeyStore } from "../ports";
import type { Verifiers } from "../webauthn";
import { realVerifiers } from "../webauthn";

export interface BeginRegistrationDeps {
  store: PasskeyStore;
  verifiers?: Verifiers;
  challengeTtlSeconds?: number;
  now?: () => number;
  correlationId?: string;
}

export interface BeginRegistrationInput {
  // The host app's authenticated user (registration is session-gated).
  user: { id: string; name?: string | null; identifier: string };
  rpId: string;
  rpName: string;
  // origins are only needed at verify time; accepted here for symmetry.
  origins?: string[];
}

// Step 1 of registration (session-gated). Generate WebAuthn creation options for the
// signed-in user, excluding their already-registered credentials, and stash the
// challenge under reg:<userId> for verifyRegistration to consume.
export async function beginRegistration(input: BeginRegistrationInput, deps: BeginRegistrationDeps) {
  const meta = passkeyMeta(deps);
  const verifiers = deps.verifiers ?? realVerifiers;
  const userId = String(input?.user?.id ?? "").trim();
  if (!userId) {
    return err(400, { code: "passkey.INVALID_INPUT", message: "An authenticated user id is required." }, meta);
  }
  if (!input.rpId || !input.rpName) {
    return err(400, { code: "passkey.INVALID_INPUT", message: "rpId and rpName are required." }, meta);
  }

  const existing = await deps.store.getCredentialsByUser(userId);
  const options = await verifiers.generateRegistration({
    rpId: input.rpId,
    rpName: input.rpName,
    userName: input.user.identifier,
    userDisplayName: input.user.name ?? input.user.identifier,
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports as never })),
  });

  const ttl = (deps.challengeTtlSeconds ?? CHALLENGE_TTL_SECONDS) * 1000;
  const createdAt = deps.now?.() ?? Date.now();
  await deps.store.putChallenge({
    challengeKey: `reg:${userId}`,
    challenge: options.challenge,
    userId,
    createdAt,
    expiresAt: createdAt + ttl,
  });

  return ok(200, { options }, meta);
}
