import type { TableGateway } from "../ports";
import type { AdminRecord, ListQuery, ResourceDefinition } from "../types";

// In-memory gateway for local dev and tests. Seed initial rows per table name.
export function createMemoryTableGateway(seed: Record<string, AdminRecord[]> = {}): TableGateway {
  const tables = new Map<string, Map<string, AdminRecord>>();
  for (const [table, rows] of Object.entries(seed)) {
    const map = new Map<string, AdminRecord>();
    for (const row of rows) map.set(String(row.id ?? crypto.randomUUID()), { ...row });
    tables.set(table, map);
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
        rows = rows.filter((r) => def.searchable!.some((col) => String(r[col] ?? "").toLowerCase().includes(term)));
      }
      for (const [key, value] of Object.entries(query.filters ?? {})) {
        rows = rows.filter((r) => r[key] === value);
      }

      const total = rows.length;
      if (query.sort) {
        const { column, direction } = query.sort;
        rows.sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * (direction === "desc" ? -1 : 1));
      }
      const limit = query.limit ?? 25;
      const offset = query.offset ?? 0;
      return { rows: rows.slice(offset, offset + limit).map((r) => ({ ...r })), total, limit, offset };
    },

    async get(def, id) {
      const row = tableOf(def).get(id);
      return row ? { ...row } : null;
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
