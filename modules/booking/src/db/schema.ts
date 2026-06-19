// Drizzle schema for the booking module's D1 adapter. Mirrors the booking +
// customer migrations (see modules/*/migrations/*.sql and the test harness DDL).
//
// NOTE on the cross-module table: `customers` is owned by @microservices-sh/
// customer; booking only READS name/email via a join, so the columns it needs
// are re-declared here. (This duplication is an inherent cost of putting an ORM
// schema inside a module that joins another module's table.)
//
// Timestamps are ISO-8601 TEXT (not epoch integers) — matching this module's SQL.
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  serviceId: text("service_id").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  status: text("status").notNull().default("confirmed"),
  notes: text("notes"),
  accessToken: text("access_token"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Read-only join target, owned by the customer module.
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const domainEvents = sqliteTable("domain_events", {
  id: text("id").primaryKey(),
  eventName: text("event_name").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  eventName: text("event_name").notNull(),
  actorId: text("actor_id"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
