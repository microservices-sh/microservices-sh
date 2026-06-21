# Storage Entitlements

Status: draft
Module ID: `storage-entitlements`
Mount: `/storage-entitlements`

## Summary
Storage quota, package, purchase, and share-link metadata for file-heavy templates. Owns quota accounting and entitlement state; object bytes and signed upload URLs stay with file/media adapters.

## Dependencies
- none

Optional integrations:

- auth
- audit-log

## Permissions
- storage-entitlements.read
- storage-entitlements.write
- storage-entitlements.admin
- storage-entitlements.extend
- storage-entitlements.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- storage_accounts
- storage_packages
- storage_purchases
- storage_share_links

## RPC
- `getStorageInfo` with `storage-entitlements.read`
- `reserveStorageBytes` with `storage-entitlements.write`
- `releaseStorageBytes` with `storage-entitlements.write`
- `createStoragePackage` with `storage-entitlements.admin`
- `completeStoragePurchase` with `storage-entitlements.write`
- `createShareLink` with `storage-entitlements.write`
- `resolveShareLink` public share-link lookup

## Hooks
- beforeStorageEntitlementsCreate
- afterStorageEntitlementsUpdated

## Events
Emits:

- storage-entitlements.created
- storage-entitlements.updated
- storage-entitlements.quota.updated
- storage-entitlements.purchase.completed
- storage-entitlements.share.created
- storage-entitlements.share.downloaded
- storage-entitlements.share.revoked

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- PII fields
- production deploy behavior
- external side effects

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
