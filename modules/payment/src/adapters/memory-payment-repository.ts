import type { PaymentRepository } from "../ports";
import type { Payment } from "../types";

export function createMemoryPaymentRepository(): PaymentRepository {
  const payments = new Map<string, Payment>();

  return {
    async insert(payment) {
      payments.set(payment.id, { ...payment });
    },

    async getById(id) {
      const payment = payments.get(id);
      return payment ? { ...payment } : null;
    },

    async getByIntentId(intentId) {
      for (const payment of payments.values()) {
        if (payment.intentId === intentId) return { ...payment };
      }
      return null;
    },

    async updateStatus(intentId, status, updatedAt) {
      for (const payment of payments.values()) {
        if (payment.intentId === intentId) {
          const next = { ...payment, status, updatedAt };
          payments.set(payment.id, next);
          return { ...next };
        }
      }
      return null;
    },

    async list(filter) {
      let rows = [...payments.values()];
      if (filter.customerId) rows = rows.filter((payment) => payment.customerId === filter.customerId);
      if (filter.status) rows = rows.filter((payment) => payment.status === filter.status);
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.slice(0, filter.limit ?? 100).map((payment) => ({ ...payment }));
    }
  };
}
