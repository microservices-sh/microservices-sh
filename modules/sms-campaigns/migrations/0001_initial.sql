CREATE TABLE IF NOT EXISTS sms_contacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  opt_in INTEGER NOT NULL DEFAULT 1,
  opt_in_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  UNIQUE(tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS sms_contact_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sms_group_contacts (
  tenant_id TEXT NOT NULL,
  group_id TEXT NOT NULL REFERENCES sms_contact_groups(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES sms_contacts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, group_id, contact_id)
);

CREATE TABLE IF NOT EXISTS sms_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sms_provider_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  vendor TEXT NOT NULL CHECK (vendor IN ('clicksend', 'twilio', 'sns', 'memory')),
  is_default INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  api_key_ref TEXT,
  sender_id TEXT NOT NULL,
  quota_limit INTEGER,
  quota_used INTEGER NOT NULL DEFAULT 0,
  quota_reset_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, vendor)
);

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template_id TEXT REFERENCES sms_templates(id) ON DELETE SET NULL,
  vendor TEXT NOT NULL CHECK (vendor IN ('clicksend', 'twilio', 'sns', 'memory')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled')),
  send_type TEXT NOT NULL CHECK (send_type IN ('immediate', 'scheduled')),
  scheduled_at TEXT,
  message TEXT NOT NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sms_campaign_recipients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES sms_contacts(id) ON DELETE RESTRICT,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped')),
  vendor_message_id TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_delivery_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT REFERENCES sms_campaigns(id) ON DELETE SET NULL,
  recipient_id TEXT REFERENCES sms_campaign_recipients(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES sms_contacts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  vendor TEXT NOT NULL CHECK (vendor IN ('clicksend', 'twilio', 'sns', 'memory')),
  vendor_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  cost_cents INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, vendor, vendor_message_id)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_contacts_tenant_phone ON sms_contacts (tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_sms_contacts_tenant_opt_in ON sms_contacts (tenant_id, opt_in);
CREATE INDEX IF NOT EXISTS idx_sms_groups_tenant ON sms_contact_groups (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_group_contacts_group ON sms_group_contacts (tenant_id, group_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_tenant ON sms_templates (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_provider_configs_tenant ON sms_provider_configs (tenant_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_tenant_status ON sms_campaigns (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_due ON sms_campaigns (tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sms_recipients_campaign ON sms_campaign_recipients (tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_recipients_status ON sms_campaign_recipients (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_campaign ON sms_delivery_logs (tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_vendor_message ON sms_delivery_logs (tenant_id, vendor, vendor_message_id);
