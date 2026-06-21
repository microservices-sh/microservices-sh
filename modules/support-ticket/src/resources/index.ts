export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "support_tickets",
      "support_ticket_sequences",
      "support_ticket_comments",
      "support_ticket_attachments",
      "support_ticket_share_tokens",
      "domain_events"
    ]
  }
] as const;
