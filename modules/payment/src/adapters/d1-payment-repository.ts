import type { PaymentRepository } from "../ports";
import type { Payment, PaymentStatus } from "../types";

function rowToPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    intentId: String(row.intent_id),
    customerId: String(row.customer_id),
    amount: Number(row.amount),
    currency: String(row.currency),
    status: String(row.status) as PaymentStatus,
    description: row.description ? String(row.description) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1PaymentRepository(db: D1Database): PaymentRepository {
  return {
    async insert(payment) {
      await db
        .prepare(
          "INSERT INTO payments (id, intent_id, customer_id, amount, currency, status, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          payment.id,
          payment.intentId,
          payment.customerId,
          payment.amount,
          payment.currency,
          payment.status,
          payment.description,
          payment.createdAt,
          payment.updatedAt
        )
        .run();
    },

    async getById(id) {
      const row = await db
        .prepare("SELECT * FROM payments WHERE id = ?")
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToPayment(row) : null;
    },

    async getByIntentId(intentId) {
      const row = await db
        .prepare("SELECT * FROM payments WHERE intent_id = ?")
        .bind(intentId)
        .first<Record<string, unknown>>();
      return row ? rowToPayment(row) : null;
    },

    async updateStatus(intentId, status, updatedAt) {
      await db
        .prepare("UPDATE payments SET status = ?, updated_at = ? WHERE intent_id = ?")
        .bind(status, updatedAt, intentId)
        .run();
      const row = await db
        .prepare("SELECT * FROM payments WHERE intent_id = ?")
        .bind(intentId)
        .first<Record<string, unknown>>();
      return row ? rowToPayment(row) : null;
    },

    async recordWebhookEventKey(eventId, recordedAt) {
      try {
        await db
          .prepare("INSERT INTO payment_webhook_events (event_id, recorded_at) VALUES (?, ?)")
          .bind(eventId, recordedAt)
          .run();
        return true;
      } catch {
        return false;
      }
    },

    async list(filter) {
      const clauses: string[] = [];
      const binds: unknown[] = [];
      if (filter.customerId) {
        clauses.push("customer_id = ?");
        binds.push(filter.customerId);
      }
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = filter.limit ?? 100;
      const result = await db
        .prepare(`SELECT * FROM payments ${where} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToPayment);
    }
  };
}
