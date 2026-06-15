-- Image Generation module table (image-generation module owns this contract).
-- Image bytes live in R2 (IMAGE_BUCKET); this table holds metadata + provenance.

CREATE TABLE IF NOT EXISTS image_generations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  provider TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_generations_tenant ON image_generations(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_image_generations_key ON image_generations(key);
