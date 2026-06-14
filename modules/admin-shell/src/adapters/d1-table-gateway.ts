import type { TableGateway } from "../ports";
import type { AdminRecord, ListQuery, ResourceDefinition } from "../types";

// Identifiers come from the ResourceDefinition (trusted registry), never from the
// request. We still validate their shape and quote them, and bind every value —
// so the generic query builder is not an injection vector.
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function q(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return `"${name}"`;
}

function bindable(value: string | number | boolean): string | number {
  return typeof value === "boolean" ? (value ? 1 : 0) : value;
}

// Build the shared WHERE (active filter + search + equality filters).
function buildWhere(def: ResourceDefinition, query: ListQuery): { sql: string; binds: (string | number)[] } {
  const clauses: string[] = [];
  const binds: (string | number)[] = [];

  if (def.softDelete && !query.includeDeleted) {
    clauses.push(`(${q(def.softDelete.column)} IS NULL OR ${q(def.softDelete.column)} != ?)`);
    binds.push(def.softDelete.deletedValue);
  }

  if (query.search && def.searchable && def.searchable.length > 0) {
    const ors = def.searchable.map((col) => `${q(col)} LIKE ?`);
    clauses.push(`(${ors.join(" OR ")})`);
    for (const _ of def.searchable) binds.push(`%${query.search}%`);
  }

  for (const [key, value] of Object.entries(query.filters ?? {})) {
    clauses.push(`${q(key)} = ?`);
    binds.push(bindable(value));
  }

  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

export function createD1TableGateway(db: D1Database): TableGateway {
  return {
    async list(def, query) {
      const selectCols = Array.from(new Set([def.primaryKey, ...def.columns.map((c) => c.name)])).map(q).join(", ");
      const where = buildWhere(def, query);
      const limit = query.limit ?? 25;
      const offset = query.offset ?? 0;

      const order = query.sort ? ` ORDER BY ${q(query.sort.column)} ${query.sort.direction === "desc" ? "DESC" : "ASC"}` : "";

      const countRow = await db
        .prepare(`SELECT COUNT(*) AS n FROM ${q(def.table)} ${where.sql}`)
        .bind(...where.binds)
        .first<{ n: number }>();
      const total = Number(countRow?.n ?? 0);

      const result = await db
        .prepare(`SELECT ${selectCols} FROM ${q(def.table)} ${where.sql}${order} LIMIT ? OFFSET ?`)
        .bind(...where.binds, limit, offset)
        .all<AdminRecord>();

      return { rows: result.results ?? [], total, limit, offset };
    },

    async get(def, id) {
      const selectCols = Array.from(new Set([def.primaryKey, ...def.columns.map((c) => c.name)])).map(q).join(", ");
      const row = await db
        .prepare(`SELECT ${selectCols} FROM ${q(def.table)} WHERE ${q(def.primaryKey)} = ?`)
        .bind(id)
        .first<AdminRecord>();
      return row ?? null;
    },

    async insert(def, id, values) {
      const cols = [def.primaryKey, ...Object.keys(values)];
      const placeholders = cols.map(() => "?").join(", ");
      const binds = [id, ...Object.values(values).map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : (v as string | number | null)))];
      await db
        .prepare(`INSERT INTO ${q(def.table)} (${cols.map(q).join(", ")}) VALUES (${placeholders})`)
        .bind(...binds)
        .run();
    },

    async update(def, id, values) {
      const keys = Object.keys(values);
      if (keys.length === 0) return false;
      const setSql = keys.map((k) => `${q(k)} = ?`).join(", ");
      const binds = [...Object.values(values).map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : (v as string | number | null))), id];
      const res = await db.prepare(`UPDATE ${q(def.table)} SET ${setSql} WHERE ${q(def.primaryKey)} = ?`).bind(...binds).run();
      return (res.meta?.changes ?? 0) > 0;
    },

    async softDelete(def, id) {
      if (!def.softDelete) return false;
      const res = await db
        .prepare(`UPDATE ${q(def.table)} SET ${q(def.softDelete.column)} = ? WHERE ${q(def.primaryKey)} = ?`)
        .bind(def.softDelete.deletedValue, id)
        .run();
      return (res.meta?.changes ?? 0) > 0;
    },

    async hardDelete(def, id) {
      const res = await db.prepare(`DELETE FROM ${q(def.table)} WHERE ${q(def.primaryKey)} = ?`).bind(id).run();
      return (res.meta?.changes ?? 0) > 0;
    }
  };
}
