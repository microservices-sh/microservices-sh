# Commerce Sync

Status: draft
Module ID: `commerce-sync`
Mount: `/commerce-sync`

## Summary
Provider-neutral commerce integration records, external resource mappings, sync runs, webhook receipts, and normalized order/product sync envelopes.

## Dependencies
- product-catalog
- sales-order
- optional: customer, inventory, webhook-delivery, audit-log

## Permissions
- commerce-sync.read
- commerce-sync.write
- commerce-sync.admin
- commerce-sync.extend
- commerce-sync.observe

## Resources
- D1

## Secrets
- none

Provider credentials must remain opaque secret references, not plaintext D1 values. Template adapters may require provider-specific runtime secrets such as `WOOCOMMERCE_WEBHOOK_SECRET` or `WOOCOMMERCE_CREDENTIALS_JSON`, and individual connections may point at `secretRef` / `env:<KEY>` values.

## Hooks
- beforeCommerceConnectionCreate
- beforeCommerceSyncRun
- beforeCommerceWebhookRecord
- afterCommercePayloadNormalized

## Events
- commerce-sync.connection_created
- commerce-sync.mapping_recorded
- commerce-sync.sync_started
- commerce-sync.sync_completed
- commerce-sync.webhook_recorded
- commerce-sync.payload_normalized

## Invariants
- Provider credentials are stored as opaque encrypted references, never plaintext D1 credentials.
- External resource mappings are unique per tenant, provider, resource type, and external ID.
- Webhook idempotency keys are unique per tenant and connection.
- Sync runs are append-only audit records with explicit completion or failure status.
- Product and order writes happen through product-catalog and sales-order ports or events.

## Approval Gate
Risk: high

Provider credential changes, webhook activation, sync execution, migrations, and production deploys require explicit approval.
