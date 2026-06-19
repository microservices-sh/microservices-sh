import { ok, err } from "@microservices-sh/connection-contract";
import { passkeyMeta } from "../meta";
import { newId } from "../crypto";
import type { PasskeyStore } from "../ports";
import type { Verifiers } from "../webauthn";
import { realVerifiers } from "../webauthn";
import type { EmitFn } from "./emit";

export interface VerifyRegistrationDeps {
  store: PasskeyStore;
  verifiers?: Verifiers;
  emit?: EmitFn;
  now?: () => number;
  correlationId?: string;
}

export interface VerifyRegistrationInput {
  userId: string;
  response: import("@simplewebauthn/types").RegistrationResponseJSON;
  rpId: string;
  origins: string[];
  name?: string;
}

// Step 2 of registration (session-gated). Consume the reg:<userId> challenge, verify
// the attestation via the injected verifier, and persist the new credential. Emits
// passkey.registered on success.
export async function verifyRegistration(input: VerifyRegistrationInput, deps: VerifyRegistrationDeps) {
  const meta = passkeyMeta(deps);
  const verifiers = deps.verifiers ?? realVerifiers;
  const userId = String(input?.userId ?? "").trim();
  if (!userId) {
    return err(400, { code: "passkey.INVALID_INPUT", message: "An authenticated user id is required." }, meta);
  }

  const challengeKey = `reg:${userId}`;
  const stored = await deps.store.getChallenge(challengeKey);
  const now = deps.now?.() ?? Date.now();
  // Single-use: consume the challenge before verifying so it can't be replayed.
  if (stored) await deps.store.deleteChallenge(challengeKey);
  if (!stored || now > stored.expiresAt) {
    return err(400, { code: "passkey.CHALLENGE_EXPIRED", message: "Registration challenge expired." }, meta);
  }

  let verification;
  try {
    verification = await verifiers.verifyRegistration({
      response: input.response,
      expectedChallenge: stored.challenge,
      expectedOrigin: input.origins,
      expectedRPID: input.rpId,
    });
  } catch (e) {
    return err(400, { code: "passkey.VERIFICATION_FAILED", message: `Verification failed: ${(e as Error).message}` }, meta);
  }

  if (!verification.verified || !verification.credential) {
    return err(400, { code: "passkey.VERIFICATION_FAILED", message: "Passkey verification failed." }, meta);
  }

  const c = verification.credential;
  const id = newId("pk");
  const name = input.name?.trim() || `Passkey ${new Date(now).toISOString().slice(0, 10)}`;
  await deps.store.saveCredential({
    id,
    userId,
    credentialId: c.id,
    publicKey: c.publicKey,
    counter: c.counter,
    name,
    transports: c.transports,
    deviceType: c.deviceType,
    backedUp: c.backedUp,
    createdAt: now,
    lastUsedAt: null,
  });

  deps.emit?.("passkey.registered", { userId, credentialId: c.id, id });
  return ok(200, { id, credentialId: c.id, name }, meta);
}
