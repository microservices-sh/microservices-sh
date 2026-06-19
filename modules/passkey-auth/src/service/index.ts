// Service surface: the framework-neutral passkey use-cases the module exposes via RPC
// (beginRegistration, verifyRegistration, beginAuthentication, verifyAuthentication,
// listCredentials, deleteCredential). Route adapters in templates call these.
export { beginRegistration } from "../use-cases/begin-registration";
export type { BeginRegistrationDeps, BeginRegistrationInput } from "../use-cases/begin-registration";
export { verifyRegistration } from "../use-cases/verify-registration";
export type { VerifyRegistrationDeps, VerifyRegistrationInput } from "../use-cases/verify-registration";
export { beginAuthentication } from "../use-cases/begin-authentication";
export type { BeginAuthenticationDeps, BeginAuthenticationInput } from "../use-cases/begin-authentication";
export { verifyAuthentication } from "../use-cases/verify-authentication";
export type { VerifyAuthenticationDeps, VerifyAuthenticationInput } from "../use-cases/verify-authentication";
export { listCredentials } from "../use-cases/list-credentials";
export type { ListCredentialsDeps, ListCredentialsInput } from "../use-cases/list-credentials";
export { deleteCredential } from "../use-cases/delete-credential";
export type { DeleteCredentialDeps, DeleteCredentialInput } from "../use-cases/delete-credential";
