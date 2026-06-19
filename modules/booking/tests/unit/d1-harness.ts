import { createTestD1 } from "@microservices-sh/test-utils";
import { createD1BookingRepository } from "../../src/adapters/d1-booking-repository";
import type { BookingRepository } from "../../src/ports";

/**
 * Integration harness that runs the real D1 adapter SQL against an in-memory
 * SQLite via the shared @microservices-sh/test-utils helper (better-sqlite3).
 *
 * better-sqlite3 (not node:sqlite) is required because the drizzle-backed adapter
 * reads results via D1's positional `.raw()`, which node:sqlite can't provide for
 * joins (it collapses duplicate column names). See the test-utils rationale.
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

const SEED = `
INSERT INTO services (id,name,description,duration_minutes,price_cents,currency,status,created_at,updated_at)
  VALUES ('svc-consultation','Consultation','60-min slot',60,0,'USD','active','2026-06-01T00:00:00.000Z','2026-06-01T00:00:00.000Z');
INSERT INTO services (id,name,description,duration_minutes,price_cents,currency,status,created_at,updated_at)
  VALUES ('svc-retired','Retired','',30,0,'USD','inactive','2026-06-01T00:00:00.000Z','2026-06-01T00:00:00.000Z');
INSERT INTO customers (id,name,email,phone,notes,created_at,updated_at)
  VALUES ('cus_ada','Ada Lovelace','ada@example.com',NULL,NULL,'2026-06-01T00:00:00.000Z','2026-06-01T00:00:00.000Z');
`;

export interface D1Harness {
  repo: BookingRepository;
  /** Underlying better-sqlite3 handle for direct assertion queries. */
  raw: { prepare(sql: string): { all(...params: unknown[]): Record<string, unknown>[] } };
}

export async function tryMakeD1(): Promise<D1Harness | null> {
  const { d1, sqlite } = createTestD1(SCHEMA, SEED);
  return { repo: createD1BookingRepository(d1), raw: sqlite };
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
