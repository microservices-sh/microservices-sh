import type { SqlDatabase, SqlStatement } from "./sqlite-graph-store";

// node:sqlite driver for the SqliteGraphStore — the zero-dependency default for
// the per-client Fly runtime (Node 22+ ships SQLite with FTS5 built in).
// Structurally typed so this module doesn't import node:sqlite (keeps tsc env
// dep-free and works on older Node where the builtin is absent). The consumer
// constructs the DB and injects it:
//
//   import { DatabaseSync } from "node:sqlite";
//   const raw = new DatabaseSync("/data/graph.db");
//   runMigration(raw, readFileSync(".../0001_research.sql", "utf8"));
//   const graph = createSqliteGraphStore(createNodeSqliteDatabase(raw));
export interface NodeSqliteStatement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
export interface NodeSqliteDatabase {
  prepare(sql: string): NodeSqliteStatement;
  exec(sql: string): void;
}

export function runMigration(db: NodeSqliteDatabase, sql: string): void {
  db.exec(sql);
}

export function createNodeSqliteDatabase(db: NodeSqliteDatabase): SqlDatabase {
  return {
    prepare(sql: string) {
      const native = db.prepare(sql);
      let args: unknown[] = [];
      const stmt: SqlStatement = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async run() {
          return native.run(...args);
        },
        async all<T = Record<string, unknown>>() {
          return { results: native.all(...args) as T[] };
        }
      };
      return stmt;
    }
  };
}
