# Support Inbox

Status: draft
Module ID: `support-inbox`
Mount: `/support-inbox`

## Summary
Tenant-scoped support widget and inbox module for widget settings, quick actions, conversations, messages, channel metadata, and agent takeover. Channel credentials are stored as secret references, not raw provider tokens.

## Dependencies
- none

Optional integrations:

- auth
- audit-log
- support-ticket
- knowledge-base-rag
- gateway

## Permissions
- support-inbox.read
- support-inbox.write
- support-inbox.agent
- support-inbox.channel-admin
- support-inbox.admin
- support-inbox.extend
- support-inbox.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- support_inbox_widget_settings
- support_inbox_quick_actions
- support_inbox_conversations
- support_inbox_messages
- support_inbox_channel_connections
- domain_events

## RPC
- `upsertWidgetSettings` with `support-inbox.admin`
- `getWidgetConfig` public widget bootstrap
- `startConversation` public visitor conversation start
- `addMessage` with `support-inbox.write`
- `listConversations` with `support-inbox.read`
- `setAgentTakeover` with `support-inbox.agent`
- `configureChannelConnection` with `support-inbox.channel-admin`

## Hooks
- beforeSupportInboxCreate
- afterSupportInboxUpdated

## Events
Emits:

- support-inbox.widget_settings_updated
- support-inbox.quick_action_created
- support-inbox.quick_action_deleted
- support-inbox.conversation_started
- support-inbox.message_added
- support-inbox.conversation_status_updated
- support-inbox.agent_takeover_updated
- support-inbox.channel_connection_configured

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- PII fields
- production deploy behavior
- external side effects
- agent takeover
- channel provider configuration

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
