CREATE TABLE IF NOT EXISTS support_inbox_widget_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  primary_color TEXT NOT NULL DEFAULT '#7c3aed',
  position TEXT NOT NULL DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left')),
  greeting TEXT NOT NULL DEFAULT 'Hi! How can I help you today?',
  placeholder TEXT NOT NULL DEFAULT 'Type your message...',
  show_branding INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, project_id)
);

CREATE TABLE IF NOT EXISTS support_inbox_quick_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('link', 'message')),
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_inbox_conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp')),
  external_id TEXT,
  user_agent TEXT,
  referrer TEXT,
  page_url TEXT,
  ip_address TEXT,
  custom_data_json TEXT NOT NULL DEFAULT '{}',
  agent_takeover INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS support_inbox_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES support_inbox_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'agent', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_inbox_channel_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  external_account_id TEXT NOT NULL,
  display_name TEXT,
  display_phone TEXT,
  webhook_verify_token_ref TEXT,
  access_token_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, project_id, channel)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_inbox_widget_settings_project ON support_inbox_widget_settings (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_support_inbox_quick_actions_project ON support_inbox_quick_actions (tenant_id, project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_support_inbox_conversations_project_status ON support_inbox_conversations (tenant_id, project_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_support_inbox_conversations_session ON support_inbox_conversations (tenant_id, project_id, session_id, status);
CREATE INDEX IF NOT EXISTS idx_support_inbox_conversations_external ON support_inbox_conversations (tenant_id, project_id, channel, external_id, status);
CREATE INDEX IF NOT EXISTS idx_support_inbox_messages_conversation ON support_inbox_messages (tenant_id, conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_inbox_channel_connections_project ON support_inbox_channel_connections (tenant_id, project_id, channel);
