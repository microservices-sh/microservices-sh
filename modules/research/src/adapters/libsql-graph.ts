import type { SqlDatabase, SqlStatement } from "./sqlite-graph-store";

// libsql/Turso driver for the SqliteGraphStore — the alternative to the
// node:sqlite default (plan 28) when you want a remote/replicated DB
// (Turso embedded replica) instead of a single-machine volume file.
// Structurally typed so this module doesn't depend on @libsql/client; inject it:
//
//   import { createClient } from "@libsql/client";
//   const graph = createSqliteGraphStore(
//     createLibsqlDatabase(createClient({ url: "file:/data/graph.db" })) // or a Turso URL
//   );
export interface LibsqlResult {
  rows: Record<string, unknown>[];
}
export interface LibsqlClient {
  execute(stmt: { sql: string; args: unknown[] }): Promise<LibsqlResult>;
}

export function createLibsqlDatabase(client: LibsqlClient): SqlDatabase {
  return {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt: SqlStatement = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async run() {
          return client.execute({ sql, args });
        },
        async all<T = Record<string, unknown>>() {
          const result = await client.execute({ sql, args });
          return { results: (result.rows ?? []) as T[] };
        }
      };
      return stmt;
    }
  };
}
