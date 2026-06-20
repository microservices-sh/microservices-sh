// ScopedStore is the convention every tenant-scoped repository/port follows
// (see plans/33, L2/L3): each read/write method takes a non-optional AuthContext
// first argument and enforces orgId scoping internally. There is no method that
// skips the scope, so an unscoped query path does not exist in the sanctioned API.
//
// This file is the storage-agnostic contract plus an executable in-memory
// reference (InMemoryScopedStore) that the leak-test exercises. It is drizzle-free;
// real adapters (Step 2+) implement the same shape over drizzle/D1, translating
// scopedFilter(ctx) into the concrete WHERE clause.

import { enforceScope, scopedFilter } from "./auth-context.js";

/**
 * Reference ScopedStore over a plain array. Rows must carry an org column
 * (default "org_id"). Every method applies the active scope: reads only ever
 * return rows for ctx.orgId, and a get/update/delete for a foreign id behaves as
 * if the row does not exist — closing the IDOR class.
 */
export class InMemoryScopedStore {
  #rows;
  #orgColumn;
  #idColumn;

  constructor({ rows = [], orgColumn = "org_id", idColumn = "id" } = {}) {
    this.#rows = rows.map((r) => ({ ...r }));
    this.#orgColumn = orgColumn;
    this.#idColumn = idColumn;
  }

  // The scope predicate used by every read/write. Built from the AuthContext only.
  #inScope(ctx, row) {
    return row[this.#orgColumn] === scopedFilter(ctx).equals;
  }

  list(ctx) {
    return this.#rows.filter((r) => this.#inScope(ctx, r)).map((r) => ({ ...r }));
  }

  get(ctx, id) {
    const row = this.#rows.find(
      (r) => r[this.#idColumn] === id && this.#inScope(ctx, r),
    );
    return row ? { ...row } : null;
  }

  // Inserts always stamp the row's org from the context, never from input — the
  // caller cannot create a row in another org.
  create(ctx, data) {
    const row = { ...data, [this.#orgColumn]: ctx.orgId };
    this.#rows.push(row);
    return { ...row };
  }

  update(ctx, id, patch) {
    const row = this.#rows.find(
      (r) => r[this.#idColumn] === id && this.#inScope(ctx, r),
    );
    if (!row) return null; // foreign or missing id → not found, no leak
    // Guard against a patch attempting to move the row out of (or into) a foreign org.
    if (this.#orgColumn in patch) enforceScope(ctx, patch[this.#orgColumn]);
    Object.assign(row, patch, { [this.#orgColumn]: ctx.orgId });
    return { ...row };
  }

  delete(ctx, id) {
    const idx = this.#rows.findIndex(
      (r) => r[this.#idColumn] === id && this.#inScope(ctx, r),
    );
    if (idx === -1) return false; // foreign or missing id → no-op, no leak
    this.#rows.splice(idx, 1);
    return true;
  }
}
