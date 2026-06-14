import type { Subscription } from "./types";

// Customization seam: inspect/adjust or block a subscription transition (start,
// plan change, cancel). Return null to block. Default pass-through.
export async function beforeSubscriptionChange(
  _action: "start" | "change_plan" | "cancel",
  sub: Subscription
): Promise<Subscription | null> {
  return sub;
}

// Customization seam: react when a subscription becomes active (grant access,
// send receipt). Default no-op.
export async function onSubscriptionActivated(_sub: Subscription): Promise<void> {
  return;
}

// Customization seam: react when a subscription goes past_due (start dunning,
// warn the customer). Default no-op.
export async function onSubscriptionPastDue(_sub: Subscription): Promise<void> {
  return;
}
