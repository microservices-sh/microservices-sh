// Adapter-parity contract test.
//
// The memory gateway is the test double for D1 across the whole admin-shell suite,
// but nothing else asserts the two AGREE — so divergences (sort order, relation
// WHERE, null vs undefined projection) stay invisible in CI and only bite in prod.
// This test runs the SAME operations through both gateways — the memory gateway
// and the real D1 SQL gateway backed by an in-process SQLite (node:sqlite) — and
// asserts byte-identical results. A real divergence fails here, not in production.
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryTableGateway } from "./adapters/memory-table-gateway";
import { createD1TableGateway } from "./adapters/d1-table-gateway";
import type { TableGateway } from "./ports";
import type { AdminRecord, RelationDef, ResourceDefinition } from "./types";

import { DatabaseSync } from "node:sqlite";

// Wrap node:sqlite in the D1Database shape the gateway calls (prepare → bind →
// first/all/run). This exercises the gateway's real SQL against a real SQL engine.
function makeD1(db: DatabaseSync): D1Database {
  const shim = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- node:sqlite SQLInputValue
      let bound: any[] = [];
      const handle = {
        bind(...args: unknown[]) {
          bound = args as unknown[];
          return handle;
        },
        async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
          const row = stmt.get(...bound);
          if (row === undefined || row === null) return null;
          return (col === undefined ? row : (row as Record<string, unknown>)[col]) as T;
        },
        async all<T = Record<string, unknown>>() {
          return { results: stmt.all(...bound) as T[], success: true, meta: {} };
        },
        async run() {
          const r = stmt.run(...bound);
          return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
      };
      return handle;
    },
  };
  return shim as unknown as D1Database;
}

// --- Fixtures: created_at values deliberately cross digit widths (9 vs 100) so a
// lexicographic sort disagrees with a numeric one. ---
const USERS: AdminRecord[] = [
  { id: "u_big", name: "Zara", email: "zara@acme.com", created_at: 100 },
  { id: "u_small", name: "Abe", email: "abe@acme.com", created_at: 9 },
];
const MEMBERSHIPS: AdminRecord[] = [
  { id: "m1", user_id: "u_big", role: "owner", created_at: 9, removed_at: null },
  { id: "m2", user_id: "u_big", role: "member", created_at: 100, removed_at: null },
  { id: "m3", user_id: "u_big", role: null, created_at: 50, removed_at: null }, // sparse role → null projection
  { id: "m4", user_id: "u_big", role: "ghost", created_at: 5, removed_at: 999 }, // removed → excluded by WHERE
  { id: "m5", user_id: "u_small", role: "owner", created_at: 1, removed_at: null },
];

const membershipsRelation: RelationDef = {
  name: "memberships",
  table: "memberships",
  foreignKey: "user_id",
  columns: ["id", "role", "created_at"],
  where: "removed_at IS NULL",
  orderBy: { column: "created_at", direction: "asc" },
};

const userDef: ResourceDefinition = {
  name: "user",
  table: "users",
  primaryKey: "id",
  columns: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
    { name: "email", type: "string" },
    { name: "created_at", type: "number" },
  ],
  computed: [
    {
      name: "active_memberships",
      type: "number",
      expression: "(SELECT COUNT(*) FROM memberships m WHERE m.user_id = users.id AND m.removed_at IS NULL)",
    },
  ],
  relations: [membershipsRelation],
  searchable: ["name", "email"],
  permissions: { read: "*", write: "*" },
};

let memory: TableGateway;
let d1: TableGateway;

beforeEach(() => {
  // Memory: seed rows + JS mirrors of the SQL computed column and relation WHERE.
  memory = createMemoryTableGateway(
    { users: [...USERS], memberships: [...MEMBERSHIPS] },
    {
      active_memberships: (row) =>
        MEMBERSHIPS.filter((m) => m.user_id === row.id && (m.removed_at === null || m.removed_at === undefined)).length,
    },
    { memberships: (r) => r.removed_at === null || r.removed_at === undefined }
  );

  // D1: same data in real SQLite.
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, created_at INTEGER);`);
  db.exec(`CREATE TABLE memberships (id TEXT PRIMARY KEY, user_id TEXT, role TEXT, created_at INTEGER, removed_at INTEGER);`);
  for (const u of USERS) {
    db.prepare(`INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)`).run(
      u.id as string, u.name as string, u.email as string, u.created_at as number
    );
  }
  for (const m of MEMBERSHIPS) {
    db.prepare(`INSERT INTO memberships (id, user_id, role, created_at, removed_at) VALUES (?, ?, ?, ?, ?)`).run(
      m.id as string, m.user_id as string, m.role as string | null, m.created_at as number, m.removed_at as number | null
    );
  }
  d1 = createD1TableGateway(makeD1(db));
});

describe("adapter parity: memory gateway == D1 gateway", () => {
  it("list sorted by a numeric column agrees (and is numeric, not lexicographic)", async () => {
    const query = { sort: { column: "created_at", direction: "asc" as const } };
    const mem = await memory.list(userDef, query);
    const sql = await d1.list(userDef, query);
    expect(mem).toEqual(sql);
    // Anchor: 9 must sort before 100 (lexicographic would put "100" first).
    expect(sql.rows.map((r) => r.id)).toEqual(["u_small", "u_big"]);
  });

  it("list sorted descending agrees", async () => {
    const query = { sort: { column: "created_at", direction: "desc" as const } };
    expect(await memory.list(userDef, query)).toEqual(await d1.list(userDef, query));
  });

  it("computed column (correlated subquery) agrees", async () => {
    const query = { sort: { column: "id", direction: "asc" as const } };
    const sql = await d1.list(userDef, query);
    expect(await memory.list(userDef, query)).toEqual(sql);
    // u_big has 3 active memberships (m4 removed), u_small has 1.
    const byId = Object.fromEntries(sql.rows.map((r) => [r.id, r.active_memberships]));
    expect(byId).toEqual({ u_big: 3, u_small: 1 });
  });

  it("search agrees", async () => {
    const query = { search: "abe", sort: { column: "id", direction: "asc" as const } };
    const sql = await d1.list(userDef, query);
    expect(await memory.list(userDef, query)).toEqual(sql);
    expect(sql.rows.map((r) => r.id)).toEqual(["u_small"]);
    expect(sql.total).toBe(1);
  });

  it("get agrees", async () => {
    expect(await memory.get(userDef, "u_big")).toEqual(await d1.get(userDef, "u_big"));
    expect(await memory.get(userDef, "missing")).toEqual(await d1.get(userDef, "missing"));
  });

  it("listRelated agrees: WHERE excludes removed rows, numeric order, NULL projection", async () => {
    const mem = await memory.listRelated(membershipsRelation, "u_big");
    const sql = await d1.listRelated(membershipsRelation, "u_big");
    expect(mem).toEqual(sql);
    // m4 (removed) excluded; ordered by created_at asc → m1(9), m3(50), m2(100).
    expect(sql.map((r) => r.id)).toEqual(["m1", "m3", "m2"]);
    // m3's sparse role is SQL NULL in D1 — memory must match with null, not undefined.
    expect(sql[1].role).toBeNull();
    expect(mem[1].role).toBeNull();
  });
});
