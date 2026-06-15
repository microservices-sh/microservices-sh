// @microservices-sh/identity — Plan 26 prototype (draft).
// User identity (accounts, login, sessions) on Better Auth, bridging to
// @microservices-sh/auth for service tokens. See README.md + plans/26-identity-better-auth.md.

export { createIdentity } from "./better-auth";
export type { Identity, IdentityConfig } from "./better-auth";
export { getSession } from "./session";
export type { ResolvedSession } from "./session";
export { rolesToScopes, mintSessionToken, hasScope } from "./bridge";
export type { IdentityUser, MintSessionTokenDeps, TokenClaims } from "./bridge";
export * as schema from "./schema";
