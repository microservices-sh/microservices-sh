import type { TableGateway } from "../ports";
import type { AdminRecord, ListQuery, RelationDef, ResourceDefinition } from "../types";

// Computes a single read-only computed column's value for one row. The D1 gateway
// evaluates the column's SQL `expression`; in memory we can't run SQL, so a
// developer supplies the equivalent JS to keep unit tests faithful. Keyed by the
// computed column's `name` (the alias). Relation-level computed columns are keyed
// "<relation.name>.<computed.name>" to avoid collisions with resource columns.
export type ComputeFns = Record<string, (row: AdminRecord) => unknown>;

// In-memory gateway for local dev and tests. Seed initial rows per table name.
// `compute` mirrors each ResourceDefinition.computed column (by alias) so the
// memory gateway projects the same read-only columns the D1 gateway derives in
// SQL — letting computed-column behaviour be unit-tested without a D1 harness.
// JS predicates mirroring each relation's trusted SQL `where`, keyed by the
// relation's `name`. Lets the memory gateway faithfully model a relation filter
// (e.g. "removed_at IS NULL") without evaluating SQL — same idea as ComputeFns.
export type RelationWhereFns = Record<string, (row: AdminRecord) => boolean>;

// Mirror SQLite ORDER BY so the memory gateway agrees with the D1 gateway:
// NULLs sort first, numbers compare numerically (NOT lexicographically — `9`
// sorts before `100`), booleans by 0/1, everything else by binary (code-unit)
// string comparison (SQLite's default BINARY collation). Previously this used
// String().localeCompare(), which ordered numeric columns wrong (e.g. epoch-ms
// timestamps across digit widths) and silently diverged from D1 in prod.
function compareValues(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull || bNull) return aNull === bNull ? 0 : aNull ? -1 : 1;
  if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

export function createMemoryTableGateway(
  seed: Record<string, AdminRecord[]> = {},
  compute: ComputeFns = {},
  relationWhere: RelationWhereFns = {}
): TableGateway {
  const tables = new Map<string, Map<string, AdminRecord>>();
  for (const [table, rows] of Object.entries(seed)) {
    const map = new Map<string, AdminRecord>();
    for (const row of rows) map.set(String(row.id ?? crypto.randomUUID()), { ...row });
    tables.set(table, map);
  }

  // Project read-only computed columns onto a copy of the row (read paths only).
  function withComputed(def: ResourceDefinition, row: AdminRecord): AdminRecord {
    if (!def.computed?.length) return { ...row };
    const out = { ...row };
    for (const col of def.computed) {
      const fn = compute[col.name];
      out[col.name] = fn ? fn(row) : null;
    }
    return out;
  }

  function tableOf(def: ResourceDefinition): Map<string, AdminRecord> {
    let map = tables.get(def.table);
    if (!map) {
      map = new Map();
      tables.set(def.table, map);
    }
    return map;
  }

  function isActive(def: ResourceDefinition, row: AdminRecord): boolean {
    if (!def.softDelete) return true;
    const v = row[def.softDelete.column];
    return v === null || v === undefined || v !== def.softDelete.deletedValue;
  }

  return {
    async list(def, query: ListQuery) {
      let rows = [...tableOf(def).values()];
      if (!query.includeDeleted) rows = rows.filter((r) => isActive(def, r));

      if (query.search && def.searchable?.length) {
        const term = query.search.toLowerCase();
        // A searchable entry may name a real column OR a computed column. For a
        // computed column we evaluate its compute fn (mirroring the D1 gateway,
        // which applies LIKE against the column's trusted SQL expression).
        const computedByName = new Map((def.computed ?? []).map((c) => [c.name, c]));
        const valueOf = (r: AdminRecord, col: string): string => {
          if (computedByName.has(col)) {
            const fn = compute[col];
            return String((fn ? fn(r) : null) ?? "");
          }
          return String(r[col] ?? "");
        };
        rows = rows.filter((r) => def.searchable!.some((col) => valueOf(r, col).toLowerCase().includes(term)));
      }
      for (const [key, value] of Object.entries(query.filters ?? {})) {
        rows = rows.filter((r) => r[key] === value);
      }

      const total = rows.length;
      if (query.sort) {
        const { column, direction } = query.sort;
        rows.sort((a, b) => compareValues(a[column], b[column]) * (direction === "desc" ? -1 : 1));
      }
      const limit = query.limit ?? 25;
      const offset = query.offset ?? 0;
      return { rows: rows.slice(offset, offset + limit).map((r) => withComputed(def, r)), total, limit, offset };
    },

    async get(def, id) {
      const row = tableOf(def).get(id);
      return row ? withComputed(def, row) : null;
    },

    async listRelated(relation: RelationDef, parentId) {
      const table = tables.get(relation.table);
      let rows = table ? [...table.values()] : [];
      // FK match. The optional trusted `where` is SQL the memory adapter can't
      // evaluate; a relation that uses `where` should supply a JS predicate via
      // the relation's `whereFn` (see createMemoryTableGateway extra arg) — but to
      // keep parity faithful without SQL we apply the registered predicate if any.
      rows = rows.filter((r) => r[relation.foreignKey] === parentId);
      const predicate = relationWhere[relation.name];
      if (predicate) rows = rows.filter(predicate);

      if (relation.orderBy) {
        const { column, direction } = relation.orderBy;
        rows = [...rows].sort((a, b) => compareValues(a[column], b[column]) * (direction === "desc" ? -1 : 1));
      }
      if (relation.limit !== undefined) rows = rows.slice(0, relation.limit);

      // Project the declared real columns plus any relation computed columns.
      return rows.map((r) => {
        const out: AdminRecord = {};
        // Missing declared columns become SQL NULL in D1 (`SELECT "col"` yields
        // null); use `?? null` so the memory projection matches rather than
        // emitting `undefined` (which JSON.stringify would drop entirely).
        for (const col of relation.columns) out[col] = r[col] ?? null;
        for (const c of relation.computed ?? []) {
          const fn = compute[`${relation.name}.${c.name}`];
          out[c.name] = fn ? fn(r) : null;
        }
        return out;
      });
    },

    async insert(def, id, values) {
      tableOf(def).set(id, { [def.primaryKey]: id, ...values });
    },

    async update(def, id, values) {
      const map = tableOf(def);
      const existing = map.get(id);
      if (!existing) return false;
      map.set(id, { ...existing, ...values });
      return true;
    },

    async softDelete(def, id) {
      if (!def.softDelete) return false;
      const map = tableOf(def);
      const existing = map.get(id);
      if (!existing) return false;
      map.set(id, { ...existing, [def.softDelete.column]: def.softDelete.deletedValue });
      return true;
    },

    async hardDelete(def, id) {
      return tableOf(def).delete(id);
    }
  };
}
