export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "sms_contacts",
      "sms_contact_groups",
      "sms_group_contacts",
      "sms_templates",
      "sms_provider_configs",
      "sms_campaigns",
      "sms_campaign_recipients",
      "sms_delivery_logs",
      "domain_events"
    ]
  }
] as const;

export const smsCampaignsResources = resources;
