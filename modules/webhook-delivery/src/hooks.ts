import type { DeliverEventInput } from "./schemas";
import type { DeliveryAttempt } from "./types";

// Customization seam: adjust or drop an outbound event before delivery.
// Default is pass-through.
export async function beforeWebhookDeliver(input: DeliverEventInput): Promise<DeliverEventInput> {
  return input;
}

// Customization seam: observe a delivery attempt result. Default is a no-op.
export async function afterWebhookDelivered(_attempt: DeliveryAttempt): Promise<void> {
  return undefined;
}
