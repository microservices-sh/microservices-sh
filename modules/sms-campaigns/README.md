# SMS Campaigns Module

Status: `draft`

Tenant-scoped SMS marketing and operations workflows for opted-in contacts, reusable groups, message templates, provider configuration, scheduled campaigns, provider dispatch, delivery callbacks, and campaign reporting.

## Public Surface

```ts
import {
  createSmsCampaignsService,
  createSmsCampaignsMemoryStore,
  createD1SmsCampaignsStore
} from "@microservices-sh/sms-campaigns";
```

## Core Use Cases

- `upsertSmsContact`
- `createSmsGroup`
- `createSmsTemplate`
- `configureSmsProvider`
- `createSmsCampaign`
- `scheduleSmsCampaign`
- `listDueSmsCampaigns`
- `dispatchSmsCampaign`
- `recordSmsDelivery`
- `getSmsCampaignReport`

## Storage

The module owns D1 tables for contacts, groups, group membership, templates, provider configs, campaigns, recipients, delivery logs, and domain events.

Provider credentials must not be stored raw in D1. Store only `apiKeyRef` or equivalent secret references and resolve the secret in the runtime adapter.

## Consent Boundary

`createSmsCampaign` filters to opted-in contacts and rejects campaigns with no opted-in recipients. Templates may surface opt-out/import tools later, but direct dispatch must go through the service and provider port.

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for `sms-campaigns`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
