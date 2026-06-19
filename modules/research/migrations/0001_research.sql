-- Research module (Research pillar, GraphRAG) schema.
-- The knowledge graph is produced by graphify (batch) and loaded here; retrieval
-- runs over these tables at query time. On the per-client Fly runtime the same
-- schema runs on local SQLite over the volume; on Cloudflare it runs on D1.

CREATE TABLE IF NOT EXISTS research_briefs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_briefs_owner ON research_briefs (owner_id);

CREATE TABLE IF NOT EXISTS graph_nodes (
  owner_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  label TEXT NOT NULL,
  file_type TEXT,
  source_file TEXT NOT NULL,
  source_location TEXT NOT NULL,
  community_id INTEGER,
  PRIMARY KEY (owner_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_community ON graph_nodes (owner_id, community_id);

CREATE TABLE IF NOT EXISTS graph_edges (
  owner_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL
);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges (owner_id, source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges (owner_id, target_id);

CREATE TABLE IF NOT EXISTS graph_communities (
  owner_id TEXT NOT NULL,
  community_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  cohesion REAL,
  PRIMARY KEY (owner_id, community_id)
);

-- Query entry-point: full-text index over node labels (SQLite/D1 FTS5).
CREATE VIRTUAL TABLE IF NOT EXISTS graph_node_fts USING fts5(
  node_id UNINDEXED,
  owner_id UNINDEXED,
  label
);

CREATE TABLE IF NOT EXISTS domain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_research_domain_events_entity ON domain_events (entity_type, entity_id);
