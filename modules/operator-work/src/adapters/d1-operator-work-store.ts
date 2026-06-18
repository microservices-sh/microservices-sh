import type { OperatorWorkStore } from "../ports";
import type {
  DailyReview,
  DailyReviewStatus,
  FocusBlock,
  FocusBlockSource,
  FocusEnergy,
  OperatorSubtask,
  OperatorTask,
  OperatorTaskPriority,
  OperatorTaskSource,
  OperatorTaskStatus,
  OperatorWorkEvent
} from "../types";

const TASK_COLUMNS =
  "id, org_id, title, detail, status, category, priority, due_label, source, created_by, updated_by, created_at, updated_at";

const FOCUS_COLUMNS =
  "id, org_id, date, time_range, title, energy, note, source, created_by, updated_by, created_at, updated_at";

const REVIEW_COLUMNS =
  "id, org_id, date, shipped, open_loops, agent_handoffs, tomorrow_first_move, markdown, status, created_by, updated_by, created_at, updated_at";

function rowToSubtask(row: Record<string, unknown>): OperatorSubtask {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    text: String(row.text),
    done: Number(row.done ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToTask(row: Record<string, unknown>, subtasks: OperatorSubtask[]): OperatorTask {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    detail: String(row.detail ?? ""),
    status: String(row.status) as OperatorTaskStatus,
    category: String(row.category),
    priority: String(row.priority) as OperatorTaskPriority,
    dueLabel: String(row.due_label),
    source: String(row.source) as OperatorTaskSource,
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    subtasks
  };
}

function rowToFocusBlock(row: Record<string, unknown>): FocusBlock {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    date: String(row.date),
    timeRange: String(row.time_range),
    title: String(row.title),
    energy: String(row.energy) as FocusEnergy,
    note: String(row.note ?? ""),
    source: String(row.source) as FocusBlockSource,
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToDailyReview(row: Record<string, unknown>): DailyReview {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    date: String(row.date),
    shipped: String(row.shipped ?? ""),
    openLoops: String(row.open_loops ?? ""),
    agentHandoffs: String(row.agent_handoffs ?? ""),
    tomorrowFirstMove: String(row.tomorrow_first_move ?? ""),
    markdown: String(row.markdown ?? ""),
    status: String(row.status) as DailyReviewStatus,
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1OperatorWorkStore(db: D1Database): OperatorWorkStore {
  async function listSubtasks(taskIds: string[]): Promise<Map<string, OperatorSubtask[]>> {
    const byTask = new Map<string, OperatorSubtask[]>();
    if (taskIds.length === 0) return byTask;

    const placeholders = taskIds.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT id, task_id, text, done, created_at, updated_at
         FROM operator_subtasks
         WHERE task_id IN (${placeholders})
         ORDER BY rowid ASC`
      )
      .bind(...taskIds)
      .all<Record<string, unknown>>();

    for (const row of result.results ?? []) {
      const subtask = rowToSubtask(row);
      const list = byTask.get(subtask.taskId) ?? [];
      list.push(subtask);
      byTask.set(subtask.taskId, list);
    }

    return byTask;
  }

  return {
    async listTasks(filter) {
      const clauses = ["org_id = ?"];
      const binds: unknown[] = [filter.orgId];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const result = await db
        .prepare(`SELECT ${TASK_COLUMNS} FROM operator_tasks WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();

      const rows = result.results ?? [];
      const subtasks = await listSubtasks(rows.map((row) => String(row.id)));
      return rows.map((row) => rowToTask(row, subtasks.get(String(row.id)) ?? []));
    },

    async getTask(orgId, taskId) {
      const row = await db
        .prepare(`SELECT ${TASK_COLUMNS} FROM operator_tasks WHERE org_id = ? AND id = ?`)
        .bind(orgId, taskId)
        .first<Record<string, unknown>>();
      if (!row) return null;
      const subtasks = await listSubtasks([taskId]);
      return rowToTask(row, subtasks.get(taskId) ?? []);
    },

    async upsertTask(task) {
      await db
        .prepare(
          `INSERT INTO operator_tasks (${TASK_COLUMNS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             detail = excluded.detail,
             status = excluded.status,
             category = excluded.category,
             priority = excluded.priority,
             due_label = excluded.due_label,
             source = excluded.source,
             updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`
        )
        .bind(
          task.id,
          task.orgId,
          task.title,
          task.detail,
          task.status,
          task.category,
          task.priority,
          task.dueLabel,
          task.source,
          task.createdBy,
          task.updatedBy,
          task.createdAt,
          task.updatedAt
        )
        .run();

      await db.prepare("DELETE FROM operator_subtasks WHERE task_id = ?").bind(task.id).run();
      for (const subtask of task.subtasks) {
        await db
          .prepare(
            `INSERT INTO operator_subtasks (id, task_id, text, done, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(subtask.id, task.id, subtask.text, subtask.done ? 1 : 0, subtask.createdAt, subtask.updatedAt)
          .run();
      }

      return task;
    },

    async updateTaskStatus(input) {
      await db
        .prepare("UPDATE operator_tasks SET status = ?, updated_by = ?, updated_at = ? WHERE org_id = ? AND id = ?")
        .bind(input.status, input.updatedBy ?? null, input.updatedAt, input.orgId, input.taskId)
        .run();
      return this.getTask(input.orgId, input.taskId);
    },

    async listFocusBlocks(filter) {
      const clauses = ["org_id = ?"];
      const binds: unknown[] = [filter.orgId];
      if (filter.date) {
        clauses.push("date = ?");
        binds.push(filter.date);
      }
      const result = await db
        .prepare(`SELECT ${FOCUS_COLUMNS} FROM operator_focus_blocks WHERE ${clauses.join(" AND ")} ORDER BY date ASC, time_range ASC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToFocusBlock);
    },

    async getFocusBlock(orgId, blockId) {
      const row = await db
        .prepare(`SELECT ${FOCUS_COLUMNS} FROM operator_focus_blocks WHERE org_id = ? AND id = ?`)
        .bind(orgId, blockId)
        .first<Record<string, unknown>>();
      return row ? rowToFocusBlock(row) : null;
    },

    async upsertFocusBlock(block) {
      await db
        .prepare(
          `INSERT INTO operator_focus_blocks (${FOCUS_COLUMNS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             date = excluded.date,
             time_range = excluded.time_range,
             title = excluded.title,
             energy = excluded.energy,
             note = excluded.note,
             source = excluded.source,
             updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`
        )
        .bind(
          block.id,
          block.orgId,
          block.date,
          block.timeRange,
          block.title,
          block.energy,
          block.note,
          block.source,
          block.createdBy,
          block.updatedBy,
          block.createdAt,
          block.updatedAt
        )
        .run();
      return block;
    },

    async listDailyReviews(filter) {
      const result = await db
        .prepare(`SELECT ${REVIEW_COLUMNS} FROM operator_daily_reviews WHERE org_id = ? ORDER BY date DESC LIMIT ?`)
        .bind(filter.orgId, filter.limit ?? 30)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToDailyReview);
    },

    async getDailyReview(orgId, date) {
      const row = await db
        .prepare(`SELECT ${REVIEW_COLUMNS} FROM operator_daily_reviews WHERE org_id = ? AND date = ?`)
        .bind(orgId, date)
        .first<Record<string, unknown>>();
      return row ? rowToDailyReview(row) : null;
    },

    async upsertDailyReview(review) {
      await db
        .prepare(
          `INSERT INTO operator_daily_reviews (${REVIEW_COLUMNS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(org_id, date) DO UPDATE SET
             shipped = excluded.shipped,
             open_loops = excluded.open_loops,
             agent_handoffs = excluded.agent_handoffs,
             tomorrow_first_move = excluded.tomorrow_first_move,
             markdown = excluded.markdown,
             status = excluded.status,
             updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`
        )
        .bind(
          review.id,
          review.orgId,
          review.date,
          review.shipped,
          review.openLoops,
          review.agentHandoffs,
          review.tomorrowFirstMove,
          review.markdown,
          review.status,
          review.createdBy,
          review.updatedBy,
          review.createdAt,
          review.updatedAt
        )
        .run();
      return this.getDailyReview(review.orgId, review.date).then((saved) => saved ?? review);
    },

    async writeEvent(event: OperatorWorkEvent) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(
          `evt_${crypto.randomUUID().slice(0, 12)}`,
          event.eventName,
          event.entityType,
          event.entityId,
          JSON.stringify(event.payload),
          new Date().toISOString()
        )
        .run();
    }
  };
}
