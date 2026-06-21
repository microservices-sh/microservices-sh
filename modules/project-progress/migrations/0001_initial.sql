CREATE TABLE IF NOT EXISTS project_progress_projects (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  access_token TEXT NOT NULL,
  qr_code_key TEXT,
  start_date TEXT,
  expected_end_date TEXT,
  actual_end_date TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, access_token)
);

CREATE TABLE IF NOT EXISTS project_progress_access (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  can_upload INTEGER NOT NULL DEFAULT 1,
  can_view INTEGER NOT NULL DEFAULT 1,
  created_by_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, project_id, user_id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES project_progress_projects (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_progress_logs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  voice_note_key TEXT,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES project_progress_projects (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_progress_media_files (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  log_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  thumbnail_key TEXT,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, log_id) REFERENCES project_progress_logs (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_progress_comments (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  log_id TEXT,
  author_type TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES project_progress_projects (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, log_id) REFERENCES project_progress_logs (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_progress_projects_customer ON project_progress_projects (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_projects_status ON project_progress_projects (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_project_progress_projects_access_token ON project_progress_projects (tenant_id, access_token);
CREATE INDEX IF NOT EXISTS idx_project_progress_access_user ON project_progress_access (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_logs_project ON project_progress_logs (tenant_id, project_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_project_progress_logs_category ON project_progress_logs (tenant_id, category, captured_at);
CREATE INDEX IF NOT EXISTS idx_project_progress_media_log ON project_progress_media_files (tenant_id, log_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_comments_project ON project_progress_comments (tenant_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_progress_comments_log ON project_progress_comments (tenant_id, log_id, created_at);
