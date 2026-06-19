import type { DomainEvent, ResearchBrief, ResearchSource, ResearchStore } from "../index";

function rowToSource(row: Record<string, unknown>): ResearchSource {
  return {
    id: String(row.id),
    title: String(row.title),
    uri: String(row.uri),
    ownerId: String(row.owner_id),
    chunkCount: Number(row.chunk_count),
    createdAt: String(row.created_at)
  };
}

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

export function createD1ResearchStore(db: D1Database): ResearchStore {
  return {
    async saveSource(source) {
      await db
        .prepare(
          `INSERT INTO research_sources (id, title, uri, owner_id, chunk_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title = excluded.title, uri = excluded.uri, chunk_count = excluded.chunk_count`
        )
        .bind(source.id, source.title, source.uri, source.ownerId, source.chunkCount, source.createdAt)
        .run();
    },

    async listSources(ownerId) {
      const result = await db
        .prepare("SELECT * FROM research_sources WHERE owner_id = ? ORDER BY created_at DESC")
        .bind(ownerId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToSource);
    },

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
