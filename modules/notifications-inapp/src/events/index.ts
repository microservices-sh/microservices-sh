// Emits its own lifecycle events. May be driven by domain events the host
// translates into notify() calls (not enumerated here — the host owns mapping
// domain events to per-user notifications).
export const events = {
  emitted: ["notification.created", "notification.read"],
  consumed: []
} as const;
