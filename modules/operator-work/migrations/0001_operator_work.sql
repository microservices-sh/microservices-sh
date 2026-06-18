CREATE TABLE IF NOT EXISTS operator_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  due_label TEXT NOT NULL,
  source TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES operator_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS operator_focus_blocks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time_range TEXT NOT NULL,
  title TEXT NOT NULL,
  energy TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_daily_reviews (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  date TEXT NOT NULL,
  shipped TEXT NOT NULL DEFAULT '',
  open_loops TEXT NOT NULL DEFAULT '',
  agent_handoffs TEXT NOT NULL DEFAULT '',
  tomorrow_first_move TEXT NOT NULL DEFAULT '',
  markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, date)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operator_tasks_org_status ON operator_tasks(org_id, status);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_org_updated ON operator_tasks(org_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_operator_subtasks_task ON operator_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_operator_focus_org_date ON operator_focus_blocks(org_id, date);
CREATE INDEX IF NOT EXISTS idx_operator_reviews_org_date ON operator_daily_reviews(org_id, date);
CREATE INDEX IF NOT EXISTS idx_operator_events_entity ON domain_events(entity_type, entity_id);
