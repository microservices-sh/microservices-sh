// @microservices-sh/identity — passwordless email-code identity + sessions, built on
// @microservices-sh/auth (no third-party auth dep, no zod migration). See README.md +
// plans/26-identity-better-auth.md.

// Use-cases (Result-enveloped)
export { requestLoginCode } from "./use-cases/request-login-code";
export type { RequestLoginCodeDeps } from "./use-cases/request-login-code";
export { verifyLoginCode } from "./use-cases/verify-login-code";
export type { VerifyLoginCodeDeps } from "./use-cases/verify-login-code";
export { readSession, destroySession } from "./use-cases/session";
export type { ReadSessionDeps } from "./use-cases/session";

// Session cookie helpers (SSR templates)
export { SESSION_COOKIE, serializeSessionCookie, clearSessionCookie, parseSessionCookie } from "./session";

// Token bridge — session user -> short-lived scoped JWT via @microservices-sh/auth
export { rolesToScopes, mintSessionToken, hasScope } from "./bridge";
export type { MintSessionTokenDeps, TokenClaims } from "./bridge";

// Persistence ports + in-memory adapters (D1 adapters mirror these)
export type { AccountStore, LoginCodeStore, SessionStore } from "./ports";
export {
  createMemoryAccountStore,
  createMemoryLoginCodeStore,
  createMemorySessionStore,
} from "./adapters/memory";

export type { IdentityUser, Account, LoginCodeRecord, SessionRecord } from "./types";
export * as config from "./config";
