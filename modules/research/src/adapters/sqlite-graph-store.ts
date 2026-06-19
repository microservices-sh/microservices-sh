import type { GraphCommunity, GraphEdge, GraphNode, GraphStore } from "../graph";

// Minimal async SQL surface (mirrors the D1Database shape). On the per-client
// Fly runtime, wrap better-sqlite3 / libsql to match this and pass it in:
//
//   const db = makeLibsqlAdapter("/data/research.db"); // your wrapper
//   const graph = createSqliteGraphStore(db);
//
// Runs the migration's graph_nodes / graph_edges / graph_communities /
// graph_node_fts tables. Not unit-tested here (no SQLite in the test sandbox) —
// covered by the integration test, like every other adapter in the repo.
export interface SqlStatement {
  bind(...args: unknown[]): SqlStatement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
}

function rowToNode(row: Record<string, unknown>): GraphNode {
  return {
    id: String(row.node_id),
    label: String(row.label),
    fileType: row.file_type ? String(row.file_type) : undefined,
    sourceFile: String(row.source_file),
    sourceLocation: String(row.source_location),
    communityId: row.community_id == null ? undefined : Number(row.community_id),
    ownerId: String(row.owner_id)
  };
}

// Tokenize free text into a safe FTS5 OR-query (drops punctuation that would
// otherwise be interpreted as FTS operators).
function ftsQuery(text: string): string {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length > 2) ?? [];
  return tokens.join(" OR ");
}

export function createSqliteGraphStore(db: SqlDatabase): GraphStore {
  return {
    async upsertNodes(nodes: GraphNode[]) {
      for (const node of nodes) {
        await db
          .prepare(
            `INSERT INTO graph_nodes (owner_id, node_id, label, file_type, source_file, source_location, community_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(owner_id, node_id) DO UPDATE SET
               label = excluded.label, file_type = excluded.file_type,
               source_file = excluded.source_file, source_location = excluded.source_location,
               community_id = excluded.community_id`
          )
          .bind(node.ownerId, node.id, node.label, node.fileType ?? null, node.sourceFile, node.sourceLocation, node.communityId ?? null)
          .run();
        await db
          .prepare("INSERT INTO graph_node_fts (node_id, owner_id, label) VALUES (?, ?, ?)")
          .bind(node.id, node.ownerId, node.label)
          .run();
      }
    },

    async upsertEdges(edges: GraphEdge[]) {
      for (const edge of edges) {
        await db
          .prepare("INSERT INTO graph_edges (owner_id, source_id, target_id, relation, weight) VALUES (?, ?, ?, ?, ?)")
          .bind(edge.ownerId, edge.sourceId, edge.targetId, edge.relation, edge.weight ?? null)
          .run();
      }
    },

    async upsertCommunities(communities: GraphCommunity[]) {
      for (const community of communities) {
        await db
          .prepare(
            `INSERT INTO graph_communities (owner_id, community_id, label, cohesion) VALUES (?, ?, ?, ?)
             ON CONFLICT(owner_id, community_id) DO UPDATE SET label = excluded.label, cohesion = excluded.cohesion`
          )
          .bind(community.ownerId, community.communityId, community.label, community.cohesion ?? null)
          .run();
      }
    },

    async searchNodes({ text, ownerId, admin, limit }) {
      const match = ftsQuery(text);
      if (!match) return [];
      const sql = admin
        ? `SELECT n.* FROM graph_node_fts f JOIN graph_nodes n ON n.node_id = f.node_id AND n.owner_id = f.owner_id
           WHERE f.label MATCH ? LIMIT ?`
        : `SELECT n.* FROM graph_node_fts f JOIN graph_nodes n ON n.node_id = f.node_id AND n.owner_id = f.owner_id
           WHERE f.label MATCH ? AND f.owner_id = ? LIMIT ?`;
      const stmt = admin ? db.prepare(sql).bind(match, limit) : db.prepare(sql).bind(match, ownerId, limit);
      const result = await stmt.all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToNode);
    },

    async neighbors(nodeIds, { ownerId, admin }) {
      if (nodeIds.length === 0) return [];
      const placeholders = nodeIds.map(() => "?").join(", ");
      const ownerClause = admin ? "" : "AND e.owner_id = ?";
      const sql = `
        SELECT DISTINCT n.* FROM graph_edges e
        JOIN graph_nodes n ON (n.node_id = e.target_id OR n.node_id = e.source_id) AND n.owner_id = e.owner_id
        WHERE (e.source_id IN (${placeholders}) OR e.target_id IN (${placeholders})) ${ownerClause}`;
      const args = admin ? [...nodeIds, ...nodeIds] : [...nodeIds, ...nodeIds, ownerId];
      const result = await db.prepare(sql).bind(...args).all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToNode).filter((node) => admin || node.ownerId === ownerId);
    },

    async getCommunity(communityId, { ownerId, admin }) {
      const sql = admin
        ? "SELECT * FROM graph_communities WHERE community_id = ? LIMIT 1"
        : "SELECT * FROM graph_communities WHERE community_id = ? AND owner_id = ? LIMIT 1";
      const stmt = admin ? db.prepare(sql).bind(communityId) : db.prepare(sql).bind(communityId, ownerId);
      const result = await stmt.all<Record<string, unknown>>();
      const row = (result.results ?? [])[0];
      if (!row) return null;
      return {
        communityId: Number(row.community_id),
        label: String(row.label),
        cohesion: row.cohesion == null ? undefined : Number(row.cohesion),
        ownerId: String(row.owner_id)
      };
    }
  };
}
