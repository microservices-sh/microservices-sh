# Source Mapping

## Targets

- Module tables when a module owns the entity: customers, bookings, invoices, payments, audit, files, orgs, subscriptions.
- Template overlays when data is app-specific and not reusable.
- R2 for object/file/blob data.
- D1 custom tables for durable relational app data that no module owns.
- Durable Objects only for live coordination, presence, or stateful realtime workflows.

## Common Transformations

- UUID/string ids: preserve as `text` where possible.
- Timestamps: choose ISO `text` or epoch `integer`; be consistent per module.
- JSON/doc fields: split into tables for queryable relationships; keep JSON text only for opaque metadata.
- Arrays of objects: child table or join table.
- Enum/status fields: explicit text values with lifecycle validation.
- Files: metadata row in D1, bytes in R2, tenant-scoped key.

## Auth Cutover

Passwords, OAuth refresh tokens, phone auth, and provider sessions usually do not transfer safely. Preserve stable user ids/emails, then require re-verification through the target auth flow.

## Verification

- Count source and target rows per entity.
- Sample joined records across relationships.
- Verify access rules with allowed and denied users.
- Confirm imports are idempotent before remote execution.
