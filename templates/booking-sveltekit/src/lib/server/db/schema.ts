// Drizzle schema — typed query layer over the same D1 tables the modules use.
//
// Boundary A (revamp plan): Drizzle is the template's data/query layer and the
// source of truth for NEW booking-domain tables. The shared module packages
// (booking/customer/auth/audit/gateway) keep their raw-SQL ports and hit these
// exact tables — so column names/types here MUST mirror migrations/*.sql.
//
// Authoritative DDL stays in migrations/*.sql (partial unique index + FKs that
// drizzle-kit can't cleanly express). This file mirrors it for typed reads.

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({ email: index("idx_customers_email").on(t.email) }),
);

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    status: text("status").notNull().default("confirmed"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    customer: index("idx_bookings_customer_id").on(t.customerId),
    serviceStarts: index("idx_bookings_service_starts").on(t.serviceId, t.startsAt),
    // NOTE: partial UNIQUE (service_id, starts_at) WHERE status='confirmed'
    // lives in migrations/0001_core.sql — drizzle-kit can't express it portably.
  }),
);

export const domainEvents = sqliteTable(
  "domain_events",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({ entity: index("idx_domain_events_entity").on(t.entityType, t.entityId) }),
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    actorId: text("actor_id"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({ entity: index("idx_audit_events_entity").on(t.entityType, t.entityId) }),
);

export const signingKeys = sqliteTable(
  "signing_keys",
  {
    kid: text("kid").primaryKey(),
    algorithm: text("algorithm").notNull(),
    publicJwk: text("public_jwk").notNull(),
    privateJwk: text("private_jwk").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    retiredAt: text("retired_at"),
  },
  (t) => ({ status: index("idx_signing_keys_status").on(t.status) }),
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    hash: text("hash").notNull().unique(),
    workspace: text("workspace").notNull(),
    project: text("project").notNull(),
    subject: text("subject").notNull(),
    scopes: text("scopes").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({ hash: index("idx_api_keys_hash").on(t.hash) }),
);

// NEW (revamp P0): single-row company settings — timezone, currency, policy.
export const companySettings = sqliteTable("company_settings", {
  id: text("id").primaryKey(), // always 'company'
  name: text("name").notNull().default("Booking"),
  timezone: text("timezone").notNull().default("UTC"),
  currency: text("currency").notNull().default("USD"),
  cancellationAllowed: integer("cancellation_allowed", { mode: "boolean" }).notNull().default(true),
  cancellationNoticeHours: integer("cancellation_notice_hours").notNull().default(24),
  reminderHours: integer("reminder_hours").notNull().default(24),
  depositPercent: integer("deposit_percent").notNull().default(0),
  holdMinutes: integer("hold_minutes").notNull().default(15),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type CompanySettings = typeof companySettings.$inferSelect;
