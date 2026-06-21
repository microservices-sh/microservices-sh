CREATE TABLE IF NOT EXISTS membership_credit_tiers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  discount_basis_points INTEGER NOT NULL DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  price_monthly_cents INTEGER,
  price_yearly_cents INTEGER,
  price_lifetime_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  benefits_json TEXT NOT NULL DEFAULT '[]',
  badge_color TEXT,
  badge_icon TEXT,
  max_advance_booking_days INTEGER,
  max_bookings_per_month INTEGER,
  priority_booking_hours INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS customer_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  tier_id TEXT NOT NULL REFERENCES membership_credit_tiers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  subscription_type TEXT NOT NULL DEFAULT 'manual' CHECK (subscription_type IN ('manual', 'monthly', 'yearly', 'lifetime')),
  started_at TEXT NOT NULL,
  expires_at TEXT,
  cancelled_at TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  grace_period_ends_at TEXT,
  external_subscription_id TEXT,
  external_customer_id TEXT,
  previous_tier_id TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_credit_balances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  total_credited_cents INTEGER NOT NULL DEFAULT 0,
  total_used_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_cents INTEGER NOT NULL,
  balance_before_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('admin_grant', 'admin_deduct', 'booking_refund', 'booking_payment', 'payment', 'adjustment')),
  reference_type TEXT,
  reference_id TEXT,
  description TEXT NOT NULL,
  performed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membership_id TEXT NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,
  from_tier_id TEXT,
  to_tier_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('created', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'expired', 'suspended', 'reactivated')),
  reason TEXT,
  performed_by TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_membership_credit_tiers_tenant_status ON membership_credit_tiers (tenant_id, status, position);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_customer ON customer_memberships (tenant_id, customer_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_expiry ON customer_memberships (tenant_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_credit_balances_customer ON customer_credit_balances (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer ON credit_transactions (tenant_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON credit_transactions (tenant_id, customer_id, type, source, reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_membership_history_membership ON membership_history (tenant_id, membership_id, created_at);
