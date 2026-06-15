// Payment provider/repository selection (revamp P3b). Memory gateway by default
// so dev works without Stripe; Stripe when STRIPE_SECRET_KEY is set. Repository
// is D1-backed in production, in-memory locally.
//
// Booking↔payment linkage is template-side: a deposit's `description` is
// `booking:<bookingId>`, so refund-on-cancel can find it.
import type { PaymentGateway, PaymentRepository } from "@microservices-sh/payment/ports";
import { listPayments, refundPayment } from "@microservices-sh/payment";
import { createD1PaymentRepository } from "@microservices-sh/payment/adapters/d1";
import { createMemoryPaymentRepository } from "@microservices-sh/payment/adapters/memory";
import { createStripePaymentGateway } from "@microservices-sh/payment/adapters/stripe-gateway";
import { createMemoryPaymentGateway } from "@microservices-sh/payment/adapters/memory-gateway";

export interface PaymentEnv {
  STRIPE_SECRET_KEY?: string;
}

// Singleton memory repo so dev state persists across requests (a deposit created
// at booking time is still findable when the booking is cancelled).
let memoryRepo: PaymentRepository | null = null;

export interface PaymentDeps {
  paymentRepository: PaymentRepository;
  paymentGateway: PaymentGateway;
}

export function getPaymentDeps(d1: D1Database | undefined, env: PaymentEnv | undefined): PaymentDeps {
  const paymentRepository = d1 ? createD1PaymentRepository(d1) : (memoryRepo ??= createMemoryPaymentRepository());
  const paymentGateway = env?.STRIPE_SECRET_KEY
    ? createStripePaymentGateway(env.STRIPE_SECRET_KEY)
    : createMemoryPaymentGateway();
  return { paymentRepository, paymentGateway };
}

export function bookingRef(bookingId: string): string {
  return `booking:${bookingId}`;
}

export function depositCents(priceCents: number, depositPercent: number): number {
  if (!priceCents || !depositPercent) return 0;
  return Math.round((priceCents * depositPercent) / 100);
}

// Find a booking's outstanding (refundable) deposit payment, if any.
export async function findBookingPayment(deps: PaymentDeps, customerId: string, bookingId: string) {
  const res = await listPayments({ customerId }, { paymentRepository: deps.paymentRepository });
  if (!res.ok) return null;
  return (
    res.data.payments.find(
      (p) => p.description === bookingRef(bookingId) && p.status !== "refunded" && p.status !== "failed",
    ) ?? null
  );
}

// Refund a booking's deposit on cancellation. Best-effort — a payment/refund
// problem must never block the cancel itself.
export async function refundBookingDeposit(
  d1: D1Database | undefined,
  env: PaymentEnv | undefined,
  customerId: string,
  bookingId: string,
): Promise<void> {
  try {
    const deps = getPaymentDeps(d1, env);
    const payment = await findBookingPayment(deps, customerId, bookingId);
    if (payment) await refundPayment({ intentId: payment.intentId }, deps);
  } catch (err) {
    console.error("Refund on cancel failed:", err);
  }
}
