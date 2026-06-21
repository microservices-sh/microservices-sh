-- billing-subscriptions module tables: plans, subscriptions, a webhook/usage
-- idempotency ledger, and usage records. Money is integer cents. Owned by
-- @microservices-sh/billing-subscriptions.

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  interval TEXT NOT NULL,            -- month | year
  stripe_price_id TEXT,
  features TEXT NOT NULL,            -- JSON array
  status TEXT NOT NULL,             -- active | archived
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,             -- trialing|active|past_due|unpaid|paused|canceled
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  current_period_start TEXT,
  current_period_end TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_open_per_subscriber ON subscriptions(subscriber_id) WHERE status <> 'canceled';

-- Idempotency ledger for Stripe webhook ids (and namespaced usage keys).
CREATE TABLE IF NOT EXISTS billing_events (
  event_id TEXT PRIMARY KEY,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  meter TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_records_sub ON usage_records(subscription_id, meter, at);
