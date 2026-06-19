import type {
  DecisionBrief,
  DecisionLog,
  DecisionStore,
  DomainEvent
} from "../index";

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

function rowToLog(row: Record<string, unknown>): DecisionLog {
  return {
    id: String(row.id),
    briefId: String(row.brief_id),
    choice: String(row.choice) as DecisionLog["choice"],
    rationale: String(row.rationale),
    ownerId: String(row.owner_id),
    decidedAt: String(row.decided_at)
  };
}

export function createD1DecisionStore(db: D1Database): DecisionStore {
  return {
    async saveBrief(brief) {
      await db
        .prepare(
          `INSERT INTO decision_briefs
             (id, question, context, sources_json, options_json, risks_json, assumptions_json, recommendation_json, owner_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             question = excluded.question,
             context = excluded.context,
             sources_json = excluded.sources_json,
             options_json = excluded.options_json,
             risks_json = excluded.risks_json,
             assumptions_json = excluded.assumptions_json,
             recommendation_json = excluded.recommendation_json,
             owner_id = excluded.owner_id,
             status = excluded.status`
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

    async getBrief(briefId) {
      const row = await db
        .prepare("SELECT * FROM decision_briefs WHERE id = ?")
        .bind(briefId)
        .first<Record<string, unknown>>();
      return row ? rowToBrief(row) : null;
    },

    async appendLog(log) {
      await db
        .prepare(
          "INSERT INTO decision_logs (id, brief_id, choice, rationale, owner_id, decided_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(log.id, log.briefId, log.choice, log.rationale, log.ownerId, log.decidedAt)
        .run();
    },

    async listLogs(briefId) {
      const result = await db
        .prepare("SELECT * FROM decision_logs WHERE brief_id = ? ORDER BY decided_at ASC")
        .bind(briefId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToLog);
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare(
          "INSERT INTO domain_events (event_name, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(event.eventName, event.entityType, event.entityId, JSON.stringify(event.payload), new Date().toISOString())
        .run();
    }
  };
}
