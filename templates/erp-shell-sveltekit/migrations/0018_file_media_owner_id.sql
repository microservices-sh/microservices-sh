-- Align the ERP shell's older file-media tables with the module adapter.
-- The adapter reads/writes owner_id for upload tickets and media files.
ALTER TABLE upload_tickets ADD COLUMN owner_id TEXT;
ALTER TABLE media_files ADD COLUMN owner_id TEXT;

CREATE INDEX IF NOT EXISTS idx_media_files_owner ON media_files(tenant_id, owner_id, status, created_at);
