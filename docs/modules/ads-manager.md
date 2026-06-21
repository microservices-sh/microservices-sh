# Ads Manager

Status: available
Module ID: `ads-manager`
Mount: `/ads`

## Summary
Cross-platform ad monitoring over an upstream ads service. Stores connection references and insight snapshots, raises anomaly alerts, and exposes normalized campaign and insight reads. Platform OAuth tokens stay in the upstream service.

## Dependencies
- none

Optional integrations:

- auth
- audit-log
- billing-subscriptions
- jobs-workflows
- notifications-inapp

## Permissions
- ads.connect
- ads.read
- ads.manage
- ads.admin
- ads.observe

## Secrets
- ADS_SERVICE_KEY

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- ad_connections
- ad_insight_snapshots
- ad_alerts

## Hooks
- beforeSync
- onAlertRaised

## Events
Emits:

- ad.account_connected
- ad.account_disconnected
- ad.insights_synced
- ad.alert_raised

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- production deploy behavior
- external side effects
- paid service activity

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
