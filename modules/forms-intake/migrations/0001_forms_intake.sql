-- Forms & Intake owns the forms and form_submissions tables. The dynamic field
-- set and submission values/attachments are stored as JSON TEXT columns, so the
-- one stored definition drives validation (no drifting copy in route code).

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,             -- draft | published | archived
  fields TEXT NOT NULL,             -- JSON array of FormField (serializable defn)
  require_turnstile INTEGER NOT NULL DEFAULT 0,  -- 0/1: enforce spam check on submit
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- All form reads/listing are tenant-scoped; index supports it.
CREATE INDEX IF NOT EXISTS idx_forms_tenant ON forms(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  values TEXT NOT NULL,             -- JSON object: active field id -> value
  attachments TEXT NOT NULL,        -- JSON array of AttachmentRef (references only)
  idempotency_key TEXT,             -- optional client dedup key (nullable)
  submitted_at TEXT NOT NULL
);

-- Submissions are listed tenant + form scoped; index supports it.
CREATE INDEX IF NOT EXISTS idx_form_submissions_scope ON form_submissions(tenant_id, form_id, submitted_at);

-- Idempotency ledger: the UNIQUE constraint makes recordSubmissionKey atomic, so a
-- retried POST is stored exactly once. This is the dedup guard agents omit, which
-- double-stores submissions on a flaky network retry.
CREATE TABLE IF NOT EXISTS submission_keys (
  form_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  PRIMARY KEY (form_id, idempotency_key)
);
