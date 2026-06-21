# Support Inbox Module

Status: `draft`

Tenant-scoped support widget and inbox workflows for widget settings, quick actions, conversations, messages, channel metadata, and agent takeover.

## Public Surface

```ts
import {
  createSupportInboxService,
  createSupportInboxMemoryStore,
  createD1SupportInboxStore
} from "@microservices-sh/support-inbox";
```

## Core Use Cases

- `upsertWidgetSettings`
- `createQuickAction`
- `deleteQuickAction`
- `getWidgetConfig`
- `startConversation`
- `addMessage`
- `listConversations`
- `getConversationThread`
- `updateConversationStatus`
- `setAgentTakeover`
- `configureChannelConnection`

## Boundaries

This module owns widget/inbox state. Ticket escalation belongs in `support-ticket`; grounded answers belong in `knowledge-base-rag`; provider webhook authentication belongs near `gateway`.

Channel credentials must be stored as secret references such as `accessTokenRef`, not raw access tokens.

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for `support-inbox`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
