import type { DailyReview, FocusBlock, OperatorSubtask, OperatorTask } from "../types";

export function nowIso(now?: () => number): string {
  return new Date(now?.() ?? Date.now()).toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

export function markdownFromReview(input: {
  shipped: string;
  openLoops: string;
  agentHandoffs: string;
  tomorrowFirstMove: string;
}): string {
  return [
    "## Shipped",
    input.shipped || "- Nothing captured yet.",
    "",
    "## Open loops",
    input.openLoops || "- No open loops captured.",
    "",
    "## Agent handoffs",
    input.agentHandoffs || "- No agent handoffs captured.",
    "",
    "## Tomorrow first move",
    input.tomorrowFirstMove || "- Choose the first action before opening inbox."
  ].join("\n");
}

export function cloneTask(task: OperatorTask): OperatorTask {
  return {
    ...task,
    subtasks: task.subtasks.map((subtask) => ({ ...subtask }))
  };
}

export function cloneSubtask(subtask: OperatorSubtask): OperatorSubtask {
  return { ...subtask };
}

export function cloneFocusBlock(block: FocusBlock): FocusBlock {
  return { ...block };
}

export function cloneDailyReview(review: DailyReview): DailyReview {
  return { ...review };
}
