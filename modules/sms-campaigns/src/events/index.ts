export const events = {
  emitted: [
    "sms-campaigns.contact_upserted",
    "sms-campaigns.group_created",
    "sms-campaigns.template_created",
    "sms-campaigns.provider_configured",
    "sms-campaigns.campaign_created",
    "sms-campaigns.campaign_scheduled",
    "sms-campaigns.campaign_dispatched",
    "sms-campaigns.delivery_recorded"
  ],
  consumed: []
} as const;

export const smsCampaignsEvents = events;
