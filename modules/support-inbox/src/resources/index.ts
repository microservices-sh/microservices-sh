export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "support_inbox_widget_settings",
      "support_inbox_quick_actions",
      "support_inbox_conversations",
      "support_inbox_messages",
      "support_inbox_channel_connections",
      "domain_events"
    ]
  }
] as const;

export const supportInboxResources = resources;
