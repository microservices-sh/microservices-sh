import type { Customer, DomainEvent } from "../types";
import type { CustomerRepository } from "../ports";

function rowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: row.phone ? String(row.phone) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1CustomerRepository(db: D1Database): CustomerRepository {
  return {
    async listCustomers() {
      const result = await db
        .prepare("SELECT id, name, email, phone, notes, created_at, updated_at FROM customers ORDER BY updated_at DESC LIMIT 100")
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToCustomer);
    },

    async getCustomer(customerId) {
      const row = await db
        .prepare("SELECT id, name, email, phone, notes, created_at, updated_at FROM customers WHERE id = ?")
        .bind(customerId)
        .first<Record<string, unknown>>();
      return row ? rowToCustomer(row) : null;
    },

    async findCustomerByEmail(email) {
      const row = await db
        .prepare("SELECT id, name, email, phone, notes, created_at, updated_at FROM customers WHERE lower(email) = lower(?)")
        .bind(email)
        .first<Record<string, unknown>>();
      return row ? rowToCustomer(row) : null;
    },

    async upsertCustomer(input) {
      const existing = await this.findCustomerByEmail(input.email);
      const timestamp = new Date().toISOString();

      if (existing) {
        await db
          .prepare("UPDATE customers SET name = ?, phone = ?, notes = ?, updated_at = ? WHERE id = ?")
          .bind(input.name, input.phone ?? null, input.notes ?? existing.notes, timestamp, existing.id)
          .run();
        return {
          ...existing,
          name: input.name,
          phone: input.phone ?? null,
          notes: input.notes ?? existing.notes,
          updatedAt: timestamp
        };
      }

      const customer: Customer = {
        id: `cus_${crypto.randomUUID().slice(0, 12)}`,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await db
        .prepare("INSERT INTO customers (id, name, email, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(customer.id, customer.name, customer.email, customer.phone, customer.notes, customer.createdAt, customer.updatedAt)
        .run();
      return customer;
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(
          `evt_${crypto.randomUUID().slice(0, 12)}`,
          event.eventName,
          event.entityType,
          event.entityId,
          JSON.stringify(event.payload),
          new Date().toISOString()
        )
        .run();
    }
  };
}
