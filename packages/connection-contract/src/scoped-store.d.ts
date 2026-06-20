import type { AuthContext } from "./auth-context";

/**
 * Contract every tenant-scoped repository/port implements. Each method takes a
 * non-optional AuthContext first argument and enforces orgId scoping internally,
 * so there is no unscoped query path in the sanctioned API.
 *
 * `T` is the row shape (must carry the org column, e.g. `org_id`). `Id` is the
 * primary-key type. Reads only ever return rows in `ctx.orgId`; a get/update/
 * delete for a foreign id behaves as not-found.
 */
export interface ScopedStore<T, Id = string> {
  list(ctx: AuthContext): T[];
  get(ctx: AuthContext, id: Id): T | null;
  create(ctx: AuthContext, data: Omit<T, "org_id"> & Partial<Pick<T, never>>): T;
  update(ctx: AuthContext, id: Id, patch: Partial<T>): T | null;
  delete(ctx: AuthContext, id: Id): boolean;
}

export interface InMemoryScopedStoreOptions<T> {
  rows?: T[];
  orgColumn?: string;
  idColumn?: string;
}

/** Executable in-memory reference implementation of the ScopedStore contract. */
export class InMemoryScopedStore<T extends Record<string, unknown>, Id = string>
  implements ScopedStore<T, Id>
{
  constructor(opts?: InMemoryScopedStoreOptions<T>);
  list(ctx: AuthContext): T[];
  get(ctx: AuthContext, id: Id): T | null;
  create(ctx: AuthContext, data: Record<string, unknown>): T;
  update(ctx: AuthContext, id: Id, patch: Partial<T>): T | null;
  delete(ctx: AuthContext, id: Id): boolean;
}
