// Shared test helper: a faithful in-memory D1Database backed by better-sqlite3.
//
// WHY better-sqlite3 and not node:sqlite: drizzle-orm/d1 reads results through
// D1's positional `.raw()` (Promise<unknown[][]>). node:sqlite only returns row
// OBJECTS, which collapse duplicate column names — so a JOIN selecting
// `services.name` and `customers.name` loses one, and drizzle maps columns to the
// wrong fields. better-sqlite3 exposes a real positional `.raw()`, so this shim
// reproduces D1 exactly, including joins. Use this for any module whose D1 adapter
// uses drizzle (or raw joins) — it's the standard module test database.
//
// better-sqlite3 is a NATIVE dep: it must be in the root pnpm
// `onlyBuiltDependencies` allowlist so CI compiles its binding on install.

// @ts-expect-error better-sqlite3 ships no bundled types; we use a minimal local surface.
import Database from "better-sqlite3";

interface Stmt {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  raw(toggle?: boolean): Stmt;
  columns(): { name: string }[];
}
interface Sqlite {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
}

function wrapAsD1(db: Sqlite): D1Database {
  const makeStmt = (sql: string, params: unknown[]) => {
    const handle = {
      bind(...p: unknown[]) {
        return makeStmt(sql, p);
      },
      async first(col?: string) {
        const row = db.prepare(sql).get(...params);
        if (row == null) return null;
        return col == null ? row : (row[col] ?? null);
      },
      async all() {
        return { results: db.prepare(sql).all(...params), success: true, meta: {} };
      },
      async run() {
        const info = db.prepare(sql).run(...params);
        return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
      },
      // D1's positional `.raw()` — what drizzle-orm/d1 calls for `.get()`/`.values()`.
      async raw(options?: { columnNames?: boolean }) {
        const stmt = db.prepare(sql);
        const names = stmt.columns().map((c) => c.name);
        const rows = stmt.raw(true).all(...params) as unknown as unknown[][];
        return options?.columnNames ? [names, ...rows] : rows;
      },
    };
    return handle;
  };
  return {
    prepare(sql: string) {
      return makeStmt(sql, []);
    },
    async batch(stmts: { run(): Promise<unknown> }[]) {
      return Promise.all(stmts.map((s) => s.run()));
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

export interface TestD1 {
  /** D1Database-shaped binding to pass into a module's createD1*Repository. */
  d1: D1Database;
  /** The underlying better-sqlite3 handle, for direct assertion queries. */
  sqlite: Sqlite;
}

/** Build a fresh in-memory D1 with `schemaSql` (and optional seed SQL) applied. */
export function createTestD1(schemaSql: string, seedSql?: string): TestD1 {
  const db: Sqlite = new Database(":memory:");
  db.exec(schemaSql);
  if (seedSql) db.exec(seedSql);
  return { d1: wrapAsD1(db), sqlite: db };
}
