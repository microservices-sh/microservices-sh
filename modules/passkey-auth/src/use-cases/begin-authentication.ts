import { ok, err } from "@microservices-sh/connection-contract";
import { passkeyMeta } from "../meta";
import { CHALLENGE_TTL_SECONDS } from "../config";
import type { PasskeyStore } from "../ports";
import type { Verifiers } from "../webauthn";
import { realVerifiers } from "../webauthn";

export interface BeginAuthenticationDeps {
  store: PasskeyStore;
  verifiers?: Verifiers;
  // Optional resolver: map a public identifier (e.g. email) to the host user id, so
  // the option set can be narrowed to that user's credentials. Omit for usernameless
  // (discoverable credential) login.
  resolveUserId?: (identifier: string) => Promise<string | null>;
  challengeTtlSeconds?: number;
  now?: () => number;
  correlationId?: string;
}

export interface BeginAuthenticationInput {
  rpId: string;
  origins?: string[];
  // Optional: narrow allowCredentials to a known user's passkeys.
  identifier?: string;
}

// Step 1 of authentication (public). Generate WebAuthn request options and stash the
// challenge under login:<uuid>. If an identifier resolves to a user, narrow
// allowCredentials to that user's passkeys; otherwise allow discoverable credentials.
export async function beginAuthentication(input: BeginAuthenticationInput, deps: BeginAuthenticationDeps) {
  const meta = passkeyMeta(deps);
  const verifiers = deps.verifiers ?? realVerifiers;
  if (!input?.rpId) {
    return err(400, { code: "passkey.INVALID_INPUT", message: "rpId is required." }, meta);
  }

  let allowCredentials: { id: string; transports: never }[] = [];
  if (input.identifier && deps.resolveUserId) {
    const userId = await deps.resolveUserId(input.identifier);
    if (userId) {
      const creds = await deps.store.getCredentialsByUser(userId);
      allowCredentials = creds.map((c) => ({ id: c.credentialId, transports: c.transports as never }));
    }
  }

  const options = await verifiers.generateAuthentication({ rpId: input.rpId, allowCredentials });

  const challengeKey = `login:${crypto.randomUUID()}`;
  const createdAt = deps.now?.() ?? Date.now();
  const ttl = (deps.challengeTtlSeconds ?? CHALLENGE_TTL_SECONDS) * 1000;
  await deps.store.putChallenge({
    challengeKey,
    challenge: options.challenge,
    userId: null,
    createdAt,
    expiresAt: createdAt + ttl,
  });

  return ok(200, { options, challengeKey }, meta);
}
