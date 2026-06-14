import type { Customer, DomainEvent } from "../types";
import type { CustomerRepository } from "../ports";

function now() {
  return new Date().toISOString();
}

export function createMemoryCustomerRepository(): CustomerRepository {
  const customers = new Map<string, Customer>();
  const events: DomainEvent[] = [];

  return {
    async listCustomers() {
      return [...customers.values()].sort((a, b) => a.name.localeCompare(b.name));
    },

    async getCustomer(customerId) {
      return [...customers.values()].find((customer) => customer.id === customerId) ?? null;
    },

    async findCustomerByEmail(email) {
      return customers.get(email.toLowerCase()) ?? null;
    },

    async upsertCustomer(input) {
      const key = input.email.toLowerCase();
      const existing = customers.get(key);
      const timestamp = now();
      const customer: Customer = {
        id: existing?.id ?? `cus_${crypto.randomUUID().slice(0, 12)}`,
        name: input.name,
        email: key,
        phone: input.phone ?? null,
        notes: input.notes ?? existing?.notes ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      customers.set(key, customer);
      return customer;
    },

    async writeEvent(event) {
      events.push(event);
    }
  };
}
