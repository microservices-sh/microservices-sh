import type { CreatePaymentIntentInput } from "./schemas";
import type { Payment } from "./types";

// Customization seam: adjust or validate intent input before the gateway call.
// Default is pass-through.
export async function beforeCreatePaymentIntent(
  input: CreatePaymentIntentInput
): Promise<CreatePaymentIntentInput> {
  return input;
}

// Customization seam: run side-effects after a payment is marked succeeded.
// Default is a no-op.
export async function afterPaymentSucceeded(_payment: Payment): Promise<void> {
  return undefined;
}
