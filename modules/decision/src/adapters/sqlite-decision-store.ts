import type { DecisionBrief, DecisionLog, DecisionStore, DomainEvent } from "../index";

// Minimal async SQL surface (mirrors the research module's SqlDatabase / D1).
// Wrap node:sqlite (Fly default) or libsql and inject it.
export interface SqlStatement {
  bind(...args: unknown[]): SqlStatement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
}

function rowToBrief(row: Record<string, unknown>): DecisionBrief {
  return {
    id: String(row.id),
    question: String(row.question),
    context: String(row.context),
    sources: JSON.parse(String(row.sources_json)),
    options: JSON.parse(String(row.options_json)),
    risks: JSON.parse(String(row.risks_json)),
    assumptions: JSON.parse(String(row.assumptions_json)),
    recommendation: JSON.parse(String(row.recommendation_json)),
    ownerId: String(row.owner_id),
    status: String(row.status) as DecisionBrief["status"],
    createdAt: String(row.created_at)
  };
}

export function createSqliteDecisionStore(db: SqlDatabase): DecisionStore {
  return {
    async saveBrief(brief: DecisionBrief) {
      await db
        .prepare(
          `INSERT INTO decision_briefs
             (id, question, context, sources_json, options_json, risks_json, assumptions_json, recommendation_json, owner_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status`
        )
        .bind(
          brief.id,
          brief.question,
          brief.context,
          JSON.stringify(brief.sources),
          JSON.stringify(brief.options),
          JSON.stringify(brief.risks),
          JSON.stringify(brief.assumptions),
          JSON.stringify(brief.recommendation),
          brief.ownerId,
          brief.status,
          brief.createdAt
        )
        .run();
    },

    async getBrief(briefId: string) {
      const result = await db.prepare("SELECT * FROM decision_briefs WHERE id = ?").bind(briefId).all<Record<string, unknown>>();
      const row = (result.results ?? [])[0];
      return row ? rowToBrief(row) : null;
    },

    async appendLog(log: DecisionLog) {
      await db
        .prepare("INSERT INTO decision_logs (id, brief_id, choice, rationale, owner_id, decided_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(log.id, log.briefId, log.choice, log.rationale, log.ownerId, log.decidedAt)
        .run();
    },

    async listLogs(briefId: string) {
      const result = await db
        .prepare("SELECT * FROM decision_logs WHERE brief_id = ? ORDER BY decided_at ASC")
        .bind(briefId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map((row) => ({
        id: String(row.id),
        briefId: String(row.brief_id),
        choice: String(row.choice) as DecisionLog["choice"],
        rationale: String(row.rationale),
        ownerId: String(row.owner_id),
        decidedAt: String(row.decided_at)
      }));
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare("INSERT INTO domain_events (event_name, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(event.eventName, event.entityType, event.entityId, JSON.stringify(event.payload), new Date().toISOString())
        .run();
    }
  };
}
