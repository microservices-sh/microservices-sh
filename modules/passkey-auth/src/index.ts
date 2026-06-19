// @microservices-sh/passkey-auth — public, source-visible passkey (WebAuthn) auth:
// registration + authentication ceremonies + credential management, built on
// @simplewebauthn/server. See README.md.
//
// BOUNDARY: this module never mints sessions. verifyAuthentication returns the verified
// userId; the host app creates the session (e.g. via @microservices-sh/identity).

// Use-cases (Result-enveloped)
export { beginRegistration } from "./use-cases/begin-registration";
export type { BeginRegistrationDeps, BeginRegistrationInput } from "./use-cases/begin-registration";
export { verifyRegistration } from "./use-cases/verify-registration";
export type { VerifyRegistrationDeps, VerifyRegistrationInput } from "./use-cases/verify-registration";
export { beginAuthentication } from "./use-cases/begin-authentication";
export type { BeginAuthenticationDeps, BeginAuthenticationInput } from "./use-cases/begin-authentication";
export { verifyAuthentication } from "./use-cases/verify-authentication";
export type { VerifyAuthenticationDeps, VerifyAuthenticationInput } from "./use-cases/verify-authentication";
export { listCredentials } from "./use-cases/list-credentials";
export type { ListCredentialsDeps, ListCredentialsInput } from "./use-cases/list-credentials";
export { deleteCredential } from "./use-cases/delete-credential";
export type { DeleteCredentialDeps, DeleteCredentialInput } from "./use-cases/delete-credential";

// Event sink seam
export type { EmitFn, PasskeyEventName } from "./use-cases/emit";

// WebAuthn verifier seam — inject fakes in tests, realVerifiers in production.
export { realVerifiers } from "./webauthn";
export type {
  Verifiers,
  VerifiedRegistration,
  VerifiedAuthentication,
} from "./webauthn";

// Persistence port + adapters (memory for tests/dev, D1 for production — same interface)
export type { PasskeyStore } from "./ports";
export { createMemoryPasskeyStore } from "./adapters/memory-passkey-store";
export { createD1PasskeyStore } from "./adapters/d1-passkey-store";

// Customization hooks
export { beforeVerifyRegistration, afterAuthenticated } from "./hooks";

export type { ChallengeRecord, CredentialRecord, CredentialSummary } from "./types";
export * as config from "./config";
