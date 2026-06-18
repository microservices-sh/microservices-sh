import type { FocusBlock, OperatorTask } from "./types";
import type { SaveDailyReviewInput, UpsertFocusBlockInput, UpsertOperatorTaskInput } from "./schemas";

export async function beforeOperatorTaskUpsert(input: UpsertOperatorTaskInput) {
  return input;
}

export async function afterOperatorTaskUpdated(input: { task: OperatorTask; created: boolean }) {
  return input;
}

export async function beforeFocusBlockUpsert(input: UpsertFocusBlockInput) {
  return input;
}

export async function beforeDailyReviewSave(input: SaveDailyReviewInput & { markdown: string }) {
  return input;
}

export async function afterFocusBlockUpdated(input: { block: FocusBlock; created: boolean }) {
  return input;
}
