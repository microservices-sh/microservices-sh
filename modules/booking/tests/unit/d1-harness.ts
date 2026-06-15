import { createRequire } from "node:module";
import { createD1BookingRepository } from "../../src/adapters/d1-booking-repository";
import type { BookingRepository } from "../../src/ports";

/**
 * Integration harness that runs the real D1 adapter SQL against an in-memory
 * SQLite database via Node's built-in `node:sqlite` (no extra dependency).
 *
 * `node:sqlite` is experimental and only present when Node is started with
 * `--experimental-sqlite` (wired into the test script via NODE_OPTIONS). When it
 * is unavailable, `tryMakeD1` returns null so the suite can `skipIf` cleanly
 * instead of hard-failing.
 */

// Schema = customer migration (customers) + booking migrations (services,
// bookings incl. access_token, events). Kept in sync with
// modules/*/migrations/*.sql (0001 + 0002 access_token).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
  phone TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  duration_minutes INTEGER NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, service_id TEXT NOT NULL,
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed', notes TEXT, access_token TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);
CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY, event_name TEXT NOT NULL, entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, event_name TEXT NOT NULL, actor_id TEXT,
  entity_type TEXT, entity_id TEXT, payload TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_confirmed_slot
  ON bookings(service_id, starts_at) WHERE status = 'confirmed';
`;

function wrapAsD1(db: any) {
  const makeStmt = (sql: string, params: unknown[]) => ({
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
      return {
        success: true,
        meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) }
      };
    }
  });
  return {
    prepare(sql: string) {
      return makeStmt(sql, []);
    }
  };
}

export interface D1Harness {
  repo: BookingRepository;
  raw: any;
}

export async function tryMakeD1(): Promise<D1Harness | null> {
  let DatabaseSync: any;
  try {
    // createRequire loads node:sqlite at native runtime, bypassing vite's
    // module resolver (vite 5 mishandles the node:sqlite specifier).
    const require = createRequire(import.meta.url);
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return null;
  }

  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);

  const t = "2026-06-01T00:00:00.000Z";
  db.prepare(
    "INSERT INTO services (id,name,description,duration_minutes,price_cents,currency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run("svc-consultation", "Consultation", "60-min slot", 60, 0, "USD", "active", t, t);
  db.prepare(
    "INSERT INTO services (id,name,description,duration_minutes,price_cents,currency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run("svc-retired", "Retired", "", 30, 0, "USD", "inactive", t, t);
  db.prepare(
    "INSERT INTO customers (id,name,email,phone,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?)"
  ).run("cus_ada", "Ada Lovelace", "ada@example.com", null, null, t, t);

  return { repo: createD1BookingRepository(wrapAsD1(db) as any), raw: db };
}

export function bookingInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: "cus_ada",
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    serviceId: "svc-consultation",
    serviceName: "Consultation",
    startsAt: "2026-07-01T09:00:00.000Z",
    endsAt: "2026-07-01T10:00:00.000Z",
    notes: null,
    accessToken: "tok_test_access_token",
    ...overrides
  };
}
