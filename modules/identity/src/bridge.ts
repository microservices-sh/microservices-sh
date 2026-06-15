import { mintToken, hasScope } from "@microservices-sh/auth";
import type { TokenClaims } from "@microservices-sh/auth/types";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";

// The authenticated human, as resolved from a Better Auth session.
export interface IdentityUser {
  id: string;
  email: string;
  isAdmin: boolean;
  role?: string;
}

// Maps an authenticated identity user to the service scopes its session token
// should carry. Admins get the `gateway.admin` scope the SSR /admin guard checks.
// Extend per role as the app's permission model grows (or delegate to
// @microservices-sh/org-team-rbac for richer authorization).
export function rolesToScopes(user: Pick<IdentityUser, "isAdmin" | "role">): string[] {
  const scopes: string[] = [];
  if (user.isAdmin) scopes.push("gateway.admin");
  return scopes;
}

export interface MintSessionTokenDeps {
  signingKeyStore: SigningKeyStore;
  workspace: string;
  project: string;
  ttlSeconds?: number;
  now?: () => number;
  correlationId?: string;
}

// The bridge (Plan 26 §6): once Better Auth has established an identity session,
// mint a short-lived scoped service JWT via @microservices-sh/auth so SSR -> /api/*
// calls carry the Plan 24 gateway token. Identity authenticates the human; this
// token authorizes the downstream service hop. Returns the auth module's Result
// envelope ({ ok, status, data: { token, claims, kid }, meta }).
export async function mintSessionToken(user: IdentityUser, deps: MintSessionTokenDeps) {
  return mintToken(
    {
      subject: user.id,
      workspace: deps.workspace,
      project: deps.project,
      scopes: rolesToScopes(user),
      ttlSeconds: deps.ttlSeconds ?? 300,
      issuer: "identity"
    },
    { signingKeyStore: deps.signingKeyStore, now: deps.now, correlationId: deps.correlationId }
  );
}

export { hasScope };
export type { TokenClaims };
