export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["api_keys", "domain_events"]
  },
  {
    type: "kv",
    binding: "RATE_LIMIT_KV"
  }
] as const;
