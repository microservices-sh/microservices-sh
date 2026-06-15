-- Image Generation owns one table of gallery metadata. Image bytes live in R2
-- under tenant-scoped keys; this table holds metadata + provenance only.

CREATE TABLE IF NOT EXISTS image_generations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  provider TEXT NOT NULL,            -- kie-ai | gemini | gpt-image
  aspect_ratio TEXT NOT NULL,
  key TEXT NOT NULL,                 -- tenant-scoped R2 key: `${tenant}/${id}.${ext}`
  mime_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,              -- studio | agent | api
  status TEXT NOT NULL,             -- active | deleted (soft delete)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- All listing/queries are tenant-scoped; index supports newest-first listing.
CREATE INDEX IF NOT EXISTS idx_image_generations_tenant ON image_generations(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_image_generations_key ON image_generations(key);
