import { ok, err } from "@microservices-sh/connection-contract";
import { passkeyMeta } from "../meta";
import type { PasskeyStore } from "../ports";
import type { Verifiers } from "../webauthn";
import { realVerifiers } from "../webauthn";
import type { EmitFn } from "./emit";

export interface VerifyAuthenticationDeps {
  store: PasskeyStore;
  verifiers?: Verifiers;
  emit?: EmitFn;
  now?: () => number;
  correlationId?: string;
}

export interface VerifyAuthenticationInput {
  response: import("@simplewebauthn/types").AuthenticationResponseJSON;
  challengeKey: string;
  rpId: string;
  origins: string[];
  // When true, reject assertions where the authenticator did not perform user
  // verification (biometric/PIN). Use for sole-factor login. Defaults to false to
  // preserve presence-only behaviour; pair with beginAuthentication's
  // userVerification: "required". See README "Boundary".
  requireUserVerification?: boolean;
}

// Step 2 of authentication (public). Consume the login challenge, verify the assertion
// against the stored credential, enforce the signature counter (clone/replay
// protection), bump it, and RETURN the verified userId.
//
// BOUNDARY: this module never mints a session. It returns userId; the host app creates
// the session (e.g. via @microservices-sh/identity). See README "Boundary".
export async function verifyAuthentication(input: VerifyAuthenticationInput, deps: VerifyAuthenticationDeps) {
  const meta = passkeyMeta(deps);
  const verifiers = deps.verifiers ?? realVerifiers;
  const challengeKey = String(input?.challengeKey ?? "");
  if (!challengeKey) {
    return err(400, { code: "passkey.INVALID_INPUT", message: "challengeKey is required." }, meta);
  }

  const stored = await deps.store.getChallenge(challengeKey);
  const now = deps.now?.() ?? Date.now();
  // Single-use: consume the challenge before verifying so it can't be replayed.
  if (stored) await deps.store.deleteChallenge(challengeKey);
  if (!stored || now > stored.expiresAt) {
    return err(400, { code: "passkey.CHALLENGE_EXPIRED", message: "Login challenge expired." }, meta);
  }

  const credential = await deps.store.getCredentialById(String(input?.response?.id ?? ""));
  if (!credential) {
    return err(401, { code: "passkey.NOT_FOUND", message: "Passkey not recognised." }, meta);
  }

  let verification;
  try {
    verification = await verifiers.verifyAuthentication({
      response: input.response,
      expectedChallenge: stored.challenge,
      expectedOrigin: input.origins,
      expectedRPID: input.rpId,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
      },
    });
  } catch (e) {
    return err(401, { code: "passkey.VERIFICATION_FAILED", message: `Verification failed: ${(e as Error).message}` }, meta);
  }

  if (!verification.verified) {
    return err(401, { code: "passkey.VERIFICATION_FAILED", message: "Passkey verification failed." }, meta);
  }

  // Sole-factor logins can demand the authenticator actually verified the user
  // (biometric/PIN), not just user presence. The crypto already validated; this
  // is the extra factor gate, opt-in via requireUserVerification.
  if (input.requireUserVerification && !verification.userVerified) {
    return err(401, { code: "passkey.USER_VERIFICATION_REQUIRED", message: "User verification (biometric/PIN) was required but not performed." }, meta);
  }

  // Signature-counter clone/replay protection. A legitimate authenticator's counter
  // strictly increases; a non-increasing value means a cloned credential replayed an
  // old assertion. The sole exception is a counter that is fixed at 0 (authenticators
  // that do not implement a counter), where 0 -> 0 is acceptable.
  const newCounter = verification.newCounter;
  const counterStuckAtZero = credential.counter === 0 && newCounter === 0;
  if (newCounter <= credential.counter && !counterStuckAtZero) {
    return err(401, { code: "passkey.COUNTER_REPLAY", message: "Passkey signature counter did not advance (possible cloned credential)." }, meta);
  }

  await deps.store.updateCounter(credential.credentialId, newCounter, now);

  deps.emit?.("passkey.authenticated", { userId: credential.userId, credentialId: credential.credentialId });
  return ok(200, { userId: credential.userId, credentialId: credential.credentialId }, meta);
}
