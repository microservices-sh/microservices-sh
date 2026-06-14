export type PaymentStatus = "pending" | "succeeded" | "refunded" | "failed";

export interface Payment {
  id: string;
  intentId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentFilter {
  customerId?: string;
  status?: PaymentStatus;
  limit?: number;
}

// Result of asking the payment gateway to create an intent.
export interface GatewayIntent {
  intentId: string;
  clientSecret: string;
  status: string;
}

// A normalized webhook event after signature verification.
export interface WebhookEvent {
  type: string;
  intentId: string;
  raw: Record<string, unknown>;
}

// A domain event the module emits.
export interface DomainEvent {
  name: string;
  payload: Record<string, unknown>;
}
