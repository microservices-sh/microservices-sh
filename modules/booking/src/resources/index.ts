export const resources = {
  d1: {
    binding: "DB",
    tables: ["services", "bookings", "domain_events", "audit_events"]
  },
  kv: {
    binding: "CACHE_KV",
    optional: true
  }
} as const;
