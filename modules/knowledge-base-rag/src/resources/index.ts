export const knowledgeBaseRagResources = [
  {
    "type": "d1",
    "binding": "DB",
    "tables": [
      "knowledge_articles",
      "knowledge_sources",
      "knowledge_attachments",
      "knowledge_web_scan_jobs",
      "knowledge_feeds",
      "domain_events"
    ]
  }
] as const;
