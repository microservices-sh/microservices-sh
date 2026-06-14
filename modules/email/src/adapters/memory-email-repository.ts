import type { DomainEvent, EmailDelivery } from "../types";
import type { EmailRepository } from "../ports";

export function createMemoryEmailRepository(): EmailRepository {
  const deliveries = new Map<string, EmailDelivery>();
  const events: DomainEvent[] = [];

  return {
    async recordDelivery(delivery) {
      deliveries.set(delivery.id, delivery);
    },

    async getDelivery(id) {
      return deliveries.get(id) ?? null;
    },

    async listDeliveries(input = {}) {
      const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
      return [...deliveries.values()]
        .filter((delivery) => {
          if (!input.recipient) return true;
          const recipient = input.recipient.toLowerCase();
          return delivery.toAddresses.some((address) => address.toLowerCase() === recipient);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async writeEvent(event) {
      events.push(event);
    }
  };
}
