import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "./schema";

export interface IdentityConfig {
  /** Signing secret for Better Auth sessions (env: AUTH_SECRET). */
  secret: string;
  /** Public base URL of the app (per-tenant custom hostname in dispatch mode). */
  baseUrl?: string;
  /** Origins allowed to start a session — include the tenant's custom hostname. */
  trustedOrigins?: string[];
}

// Per-request Better Auth instance. D1 bindings are request-scoped, so this is
// constructed inside the request handler (same pattern as stacksuite/booking-system).
//
// Email/password is the prototype's primary credential. Per Plan 26 §10.1, swap for
// the passwordless email-OTP plugin once the canonical model is decided — that is a
// one-line plugin change here, not a change to the bridge or templates.
//
// `isAdmin` is an additional user field the SSR /admin guard reads via the session;
// rolesToScopes() (see ./bridge) maps it to the gateway.admin service scope.
export function createIdentity(db: unknown, config: IdentityConfig) {
  return betterAuth({
    // drizzle adapter over the request-scoped D1 database (sqlite provider).
    database: drizzleAdapter(db as never, { provider: "sqlite", schema }),
    secret: config.secret,
    baseURL: config.baseUrl,
    trustedOrigins: config.trustedOrigins ?? [],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false
    },
    user: {
      additionalFields: {
        isAdmin: { type: "boolean", defaultValue: false }
      }
    },
    plugins: []
  });
}

export type Identity = ReturnType<typeof createIdentity>;
