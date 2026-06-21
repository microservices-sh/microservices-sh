# SMS Campaigns

Status: draft
Module ID: `sms-campaigns`
Mount: `/sms-campaigns`

## Summary
Tenant-scoped SMS contacts, opt-in groups, reusable templates, provider configuration, scheduled sends, dispatch, delivery callbacks, and campaign reporting. Provider credentials are stored as secret references, not raw values.

## Dependencies
- none

Optional integrations:

- auth
- audit-log

## Permissions
- sms-campaigns.read
- sms-campaigns.write
- sms-campaigns.dispatch
- sms-campaigns.admin
- sms-campaigns.extend
- sms-campaigns.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- sms_contacts
- sms_contact_groups
- sms_group_contacts
- sms_templates
- sms_provider_configs
- sms_campaigns
- sms_campaign_recipients
- sms_delivery_logs
- domain_events

## Hooks
- beforeSmsCampaignsCreate
- afterSmsCampaignsUpdated

## Events
Emits:

- sms-campaigns.contact_upserted
- sms-campaigns.group_created
- sms-campaigns.template_created
- sms-campaigns.provider_configured
- sms-campaigns.campaign_created
- sms-campaigns.campaign_scheduled
- sms-campaigns.campaign_dispatched
- sms-campaigns.delivery_recorded

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- PII fields
- production deploy behavior
- external side effects

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
