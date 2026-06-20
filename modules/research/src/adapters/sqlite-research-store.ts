import type { SqlDatabase } from "./sqlite-graph-store";
import type { DomainEvent, ResearchBrief, ResearchStore } from "../index";

// ResearchStore over the SqlDatabase surface (node:sqlite on Fly, or libsql).
// Briefs + events live in the same /data/graph.db as the graph.
export function createSqliteResearchStore(db: SqlDatabase): ResearchStore {
  return {
    async saveBrief(brief: ResearchBrief) {
      await db
        .prepare("INSERT INTO research_briefs (id, question, answer, citations_json, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(brief.id, brief.question, brief.answer, JSON.stringify(brief.citations), brief.ownerId, brief.createdAt)
        .run();
    },

    async getBrief(briefId: string) {
      const result = await db.prepare("SELECT * FROM research_briefs WHERE id = ?").bind(briefId).all<Record<string, unknown>>();
      const row = (result.results ?? [])[0];
      if (!row) return null;
      return {
        id: String(row.id),
        question: String(row.question),
        answer: String(row.answer),
        citations: JSON.parse(String(row.citations_json)),
        ownerId: String(row.owner_id),
        createdAt: String(row.created_at)
      };
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare("INSERT INTO domain_events (event_name, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(event.eventName, event.entityType, event.entityId, JSON.stringify(event.payload), new Date().toISOString())
        .run();
    }
  };
}
