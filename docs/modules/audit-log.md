# Audit Log

Status: available
Module ID: `audit-log`
Mount: `/audit`

## Summary
Append-only audit trail. Pure event sink: records domain events from a signed queue or direct calls.

## Dependencies
- none

## Permissions
- audit.read
- audit.export
- audit.admin

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- redactAuditPayload
- beforeAuditExport

## Events
- audit.recorded
- audit.exported

## Approval Gate
Risk: medium

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
