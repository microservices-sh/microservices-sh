# Estimate Quote

Status: draft
Module ID: `estimate-quote`
Mount: `/estimate-quote`

## Summary
Tenant-scoped estimate and quote documents with integer-cent line totals, draft edits, send/view/accept/decline/expire/void lifecycle transitions, and conversion metadata for invoice handoff.

Accounting templates may expose this module as `/app/quotes`; that route is a template adapter. The reusable module keeps the quote contract, storage, events, permissions, hooks, and migrations framework-neutral.

## Dependencies
- optional: auth, audit-log

## Permissions
- estimate-quote.read
- estimate-quote.write
- estimate-quote.admin
- estimate-quote.extend
- estimate-quote.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- beforeEstimateQuoteCreate
- afterEstimateQuoteUpdated

## Events
- estimate-quote.created
- estimate-quote.updated
- estimate-quote.sent
- estimate-quote.viewed
- estimate-quote.accepted
- estimate-quote.declined
- estimate-quote.expired
- estimate-quote.converted
- estimate-quote.voided

## Invariants
- Money is stored as integer cents.
- Quote numbers are tenant-scoped.
- Lifecycle transitions must preserve document totals and conversion audit metadata.
- Invoice creation stays outside this module; conversion returns an invoice draft payload and records the supplied invoice identity.

## Approval Gate
Risk: medium

Sending customer-facing quotes, changing lifecycle rules, changing conversion handoff behavior, adding migrations, and production deploys require explicit approval.

## Update Notes
Keep quote routes and UI in templates. Use config, hooks, and adapter ports before forking the module internals.
