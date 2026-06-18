import type { OperatorWorkStore } from "../ports";
import type { DailyReview, FocusBlock, OperatorTask, OperatorWorkEvent } from "../types";
import { cloneDailyReview, cloneFocusBlock, cloneTask } from "../use-cases/utils";

function byUpdatedDesc<T extends { updatedAt: string }>(a: T, b: T): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function byTimeRange(a: FocusBlock, b: FocusBlock): number {
  return a.timeRange.localeCompare(b.timeRange);
}

export function createMemoryOperatorWorkStore(): OperatorWorkStore {
  const tasks = new Map<string, OperatorTask>();
  const focusBlocks = new Map<string, FocusBlock>();
  const reviews = new Map<string, DailyReview>();
  const events: OperatorWorkEvent[] = [];

  return {
    async listTasks(filter) {
      const items = [...tasks.values()]
        .filter((task) => task.orgId === filter.orgId)
        .filter((task) => !filter.status || task.status === filter.status)
        .sort(byUpdatedDesc)
        .slice(0, filter.limit ?? 100);
      return items.map(cloneTask);
    },

    async getTask(orgId, taskId) {
      const task = tasks.get(taskId);
      return task && task.orgId === orgId ? cloneTask(task) : null;
    },

    async upsertTask(task) {
      const next = cloneTask(task);
      tasks.set(next.id, next);
      return cloneTask(next);
    },

    async updateTaskStatus(input) {
      const existing = tasks.get(input.taskId);
      if (!existing || existing.orgId !== input.orgId) return null;
      const next: OperatorTask = {
        ...existing,
        status: input.status,
        updatedBy: input.updatedBy ?? existing.updatedBy,
        updatedAt: input.updatedAt
      };
      tasks.set(next.id, next);
      return cloneTask(next);
    },

    async listFocusBlocks(filter) {
      const items = [...focusBlocks.values()]
        .filter((block) => block.orgId === filter.orgId)
        .filter((block) => !filter.date || block.date === filter.date)
        .sort(byTimeRange)
        .slice(0, filter.limit ?? 100);
      return items.map(cloneFocusBlock);
    },

    async getFocusBlock(orgId, blockId) {
      const block = focusBlocks.get(blockId);
      return block && block.orgId === orgId ? cloneFocusBlock(block) : null;
    },

    async upsertFocusBlock(block) {
      const next = cloneFocusBlock(block);
      focusBlocks.set(next.id, next);
      return cloneFocusBlock(next);
    },

    async listDailyReviews(filter) {
      const items = [...reviews.values()]
        .filter((review) => review.orgId === filter.orgId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, filter.limit ?? 30);
      return items.map(cloneDailyReview);
    },

    async getDailyReview(orgId, date) {
      const review = [...reviews.values()].find((item) => item.orgId === orgId && item.date === date);
      return review ? cloneDailyReview(review) : null;
    },

    async upsertDailyReview(review) {
      const existing = [...reviews.values()].find((item) => item.orgId === review.orgId && item.date === review.date);
      const next = cloneDailyReview({ ...review, id: existing?.id ?? review.id });
      if (existing) reviews.delete(existing.id);
      reviews.set(next.id, next);
      return cloneDailyReview(next);
    },

    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    }
  };
}
