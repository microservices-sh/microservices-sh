// Service surface: the framework-neutral identity use-cases the module exposes via
// RPC (requestLoginCode, verifyLoginCode, readSession, destroySession) plus the
// auth token bridge. Route adapters in templates call these.
export { requestLoginCode } from "../use-cases/request-login-code";
export type { RequestLoginCodeDeps } from "../use-cases/request-login-code";
export { verifyLoginCode } from "../use-cases/verify-login-code";
export type { VerifyLoginCodeDeps } from "../use-cases/verify-login-code";
export { readSession, destroySession } from "../use-cases/session";
export type { ReadSessionDeps } from "../use-cases/session";
export { mintSessionToken, rolesToScopes } from "../bridge";
export type { MintSessionTokenDeps } from "../bridge";
