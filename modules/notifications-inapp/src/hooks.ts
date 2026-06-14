import type { NotifyInput } from "./schemas";
import type { Notification } from "./types";

// Customization seam: inspect/transform a notification before it is persisted —
// e.g. enrich `data`, redact PII, or set a default title. Default is
// pass-through. Returning the input unchanged is always safe.
export async function beforeNotify(input: NotifyInput): Promise<NotifyInput> {
  return input;
}

// Customization seam: derive presentation fields (title/body) from the
// polymorphic `data` payload at read time without storing rendered copy.
// Default is identity. The realtime/UI layer in the host app may call this.
export async function renderNotification(notification: Notification): Promise<Notification> {
  return notification;
}
