export const emailResources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["email_deliveries", "domain_events"]
  },
  {
    type: "secret",
    binding: "RESEND_API_KEY"
  },
  {
    type: "outbound-fetch",
    host: "api.resend.com"
  }
] as const;
