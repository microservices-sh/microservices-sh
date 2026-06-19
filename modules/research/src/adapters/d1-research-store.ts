import type { DomainEvent, ResearchBrief, ResearchStore } from "../index";

function rowToBrief(row: Record<string, unknown>): ResearchBrief {
  return {
    id: String(row.id),
    question: String(row.question),
    answer: String(row.answer),
    citations: JSON.parse(String(row.citations_json)),
    ownerId: String(row.owner_id),
    createdAt: String(row.created_at)
  };
}

// D1-backed ResearchStore for clients whose research briefs live on Cloudflare.
// (On the per-client Fly runtime the graph itself lives in local SQLite — see
// ./sqlite-graph-store — while briefs can use either backend.)
export function createD1ResearchStore(db: D1Database): ResearchStore {
  return {
    async saveBrief(brief) {
      await db
        .prepare(
          "INSERT INTO research_briefs (id, question, answer, citations_json, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(brief.id, brief.question, brief.answer, JSON.stringify(brief.citations), brief.ownerId, brief.createdAt)
        .run();
    },

    async getBrief(briefId) {
      const row = await db
        .prepare("SELECT * FROM research_briefs WHERE id = ?")
        .bind(briefId)
        .first<Record<string, unknown>>();
      return row ? rowToBrief(row) : null;
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare("INSERT INTO domain_events (event_name, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(event.eventName, event.entityType, event.entityId, JSON.stringify(event.payload), new Date().toISOString())
        .run();
    }
  };
}
