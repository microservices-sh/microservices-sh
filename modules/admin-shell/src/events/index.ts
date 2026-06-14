// Platform module: emits an event per admin mutation. Wire onAdminAction to the
// audit-log module to persist a trail.
export const events = {
  emitted: ["admin.record_created", "admin.record_updated", "admin.record_deleted"],
  consumed: []
} as const;
