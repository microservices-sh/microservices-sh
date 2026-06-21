export const commerceSyncResources = [
  {
    "type": "d1",
    "binding": "DB",
    "tables": [
      "commerce_sync_connections",
      "commerce_sync_mappings",
      "commerce_sync_runs",
      "commerce_sync_webhook_receipts",
      "commerce_sync_envelopes",
      "domain_events"
    ]
  }
] as const;
