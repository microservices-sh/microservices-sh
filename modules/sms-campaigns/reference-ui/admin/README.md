# SMS Campaigns Admin Reference UI

Expected admin surfaces:

- Contacts: opt-in state, tags, import status, and group membership.
- Templates: reusable SMS body copy and character count.
- Campaigns: composer, schedule controls, approval/dispatch action, delivery report.
- Providers: enabled/default vendor, sender id, quota metadata, secret reference only.

Expected permission: `sms-campaigns.read` for read views, `sms-campaigns.write` for setup mutations, and `sms-campaigns.dispatch` for send actions.
