export const events = {
  emitted: [
    "support-inbox.widget_settings_updated",
    "support-inbox.quick_action_created",
    "support-inbox.quick_action_deleted",
    "support-inbox.conversation_started",
    "support-inbox.message_added",
    "support-inbox.conversation_status_updated",
    "support-inbox.agent_takeover_updated",
    "support-inbox.channel_connection_configured"
  ],
  consumed: []
} as const;

export const supportInboxEvents = events;
