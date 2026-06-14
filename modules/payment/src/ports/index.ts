import type { GatewayIntent, Payment, PaymentFilter, PaymentStatus } from "../types";

// Persistence boundary for payment records.
export interface PaymentRepository {
  insert(payment: Payment): Promise<void>;
  getById(id: string): Promise<Payment | null>;
  getByIntentId(intentId: string): Promise<Payment | null>;
  updateStatus(intentId: string, status: PaymentStatus, updatedAt: string): Promise<Payment | null>;
  list(filter: PaymentFilter): Promise<Payment[]>;
}

// Provider boundary abstracting Stripe. The Stripe adapter calls api.stripe.com;
// the memory adapter is used by tests so they never reach the network.
export interface PaymentGateway {
  createIntent(input: {
    amount: number;
    currency: string;
    customerId: string;
    description?: string | null;
  }): Promise<GatewayIntent>;
}
