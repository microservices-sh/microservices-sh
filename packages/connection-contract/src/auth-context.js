// AuthContext is the server-resolved tenant/actor scope (see plans/33-enforced-
// tenant-authorization-boundary.md, L1/L2). It is built from a resolved session
// — never from a URL param or request body — and is the non-optional first
// argument every tenant-scoped store method takes. Holding one is the proof that
// the caller has been authenticated and scoped to a single org.
//
// This module is intentionally storage-agnostic: it has no drizzle/D1 import.
// Adapters translate scopedFilter() into a concrete WHERE clause later (Step 2+).

import { STATUS } from "./errors.js";

// Build an AuthContext from already-resolved session fields. This does NOT read
// a session itself and is not wired to any app — callers resolve the session
// (e.g. via org-team-rbac) and hand the fields in. Validates that the required
// scope fields are present so an unscoped/partial context can never be formed.
export function authContext({ orgId, actorId, roles = [] }) {
  if (typeof orgId !== "string" || orgId.length === 0) {
    throw new Error("AuthContext requires a non-empty orgId");
  }
  if (typeof actorId !== "string" || actorId.length === 0) {
    throw new Error("AuthContext requires a non-empty actorId");
  }
  if (!Array.isArray(roles)) {
    throw new Error("AuthContext roles must be an array");
  }
  return Object.freeze({ orgId, actorId, roles: Object.freeze([...roles]) });
}

// The storage-agnostic scope descriptor. Adapters translate this into a concrete
// predicate (drizzle eq(), a D1 bind, etc.). It is NOT a drizzle expression.
export const SCOPE_COLUMN = "org_id";

export function scopedFilter(ctx) {
  return Object.freeze({ column: SCOPE_COLUMN, equals: ctx.orgId });
}

// Thrown when a row's org does not match the active AuthContext. Mirrors the
// "scope" error category (HTTP 403) from errors.js so handlers map it uniformly.
export class ScopeViolationError extends Error {
  constructor(message = "Cross-tenant access denied") {
    super(message);
    this.name = "ScopeViolationError";
    this.category = "scope";
    this.status = STATUS.scope; // 403
  }
}

// Generic guard. Returns true when the row belongs to the active org. When
// `assert` is true (the default) it throws a ScopeViolationError on mismatch so
// a leaking code path fails loudly instead of returning foreign data.
export function enforceScope(ctx, rowOrgId, { assert = true } = {}) {
  const ok = rowOrgId === ctx.orgId;
  if (!ok && assert) {
    throw new ScopeViolationError(
      `Row org ${String(rowOrgId)} is outside active scope ${ctx.orgId}`,
    );
  }
  return ok;
}
