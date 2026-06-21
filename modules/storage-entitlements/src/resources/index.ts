export const storageEntitlementsResources = [
  {
    "type": "d1",
      "binding": "DB",
      "tables": [
        "storage_accounts",
        "storage_packages",
        "storage_purchases",
        "storage_share_links",
        "domain_events"
      ]
  }
] as const;
