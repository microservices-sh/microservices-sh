import type { TokenClaims } from "./types";

export function hasScope(claims: TokenClaims, scope: string): boolean {
  return claims.scopes.includes(scope);
}

export type ScopeResult =
  | { ok: true }
  | { ok: false; status: 403; error: { code: "FORBIDDEN_SCOPE"; message: string; requiredScope: string } };

// Callee-side guard. A service calls this with the verified claims and the
// scope its own permissions require for the requested operation.
export function requireScope(claims: TokenClaims, scope: string): ScopeResult {
  if (hasScope(claims, scope)) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: {
      code: "FORBIDDEN_SCOPE",
      message: `Token is missing required scope: ${scope}.`,
      requiredScope: scope
    }
  };
}
