/**
 * Server-resolved tenant/actor scope. Built from a resolved session (never from
 * request input) and required as the first argument of every tenant-scoped store
 * method — making an unscoped query path non-existent at the type level.
 */
export interface AuthContext {
  readonly orgId: string;
  readonly actorId: string;
  readonly roles: readonly string[];
}

/** Build an AuthContext from already-resolved session fields. Throws if orgId or actorId is empty. */
export function authContext(fields: {
  orgId: string;
  actorId: string;
  roles?: readonly string[];
}): AuthContext;

/** Default org-scoping column name. */
export const SCOPE_COLUMN: "org_id";

/** Storage-agnostic scope descriptor. Adapters translate this into a concrete predicate (NOT a drizzle expression). */
export interface ScopeFilter {
  readonly column: string;
  readonly equals: string;
}

/** Return the scope descriptor for the active context. */
export function scopedFilter(ctx: AuthContext): ScopeFilter;

/** Thrown (HTTP 403 / category "scope") when a row's org does not match the active context. */
export class ScopeViolationError extends Error {
  readonly name: "ScopeViolationError";
  readonly category: "scope";
  readonly status: number;
  constructor(message?: string);
}

/**
 * Guard a row's org against the active context. Returns true on match.
 * Throws ScopeViolationError on mismatch unless `assert: false` is passed.
 */
export function enforceScope(
  ctx: AuthContext,
  rowOrgId: string,
  opts?: { assert?: boolean },
): boolean;
