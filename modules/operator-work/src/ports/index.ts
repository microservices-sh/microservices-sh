import type {
  DailyReview,
  FocusBlock,
  OperatorTask,
  OperatorTaskStatus,
  OperatorWorkEvent
} from "../types";

export interface OperatorWorkStore {
  listTasks(filter: {
    orgId: string;
    status?: OperatorTaskStatus;
    limit?: number;
  }): Promise<OperatorTask[]>;
  getTask(orgId: string, taskId: string): Promise<OperatorTask | null>;
  upsertTask(task: OperatorTask): Promise<OperatorTask>;
  updateTaskStatus(input: {
    orgId: string;
    taskId: string;
    status: OperatorTaskStatus;
    updatedBy?: string | null;
    updatedAt: string;
  }): Promise<OperatorTask | null>;
  listFocusBlocks(filter: {
    orgId: string;
    date?: string;
    limit?: number;
  }): Promise<FocusBlock[]>;
  getFocusBlock(orgId: string, blockId: string): Promise<FocusBlock | null>;
  upsertFocusBlock(block: FocusBlock): Promise<FocusBlock>;
  listDailyReviews(filter: {
    orgId: string;
    limit?: number;
  }): Promise<DailyReview[]>;
  getDailyReview(orgId: string, date: string): Promise<DailyReview | null>;
  upsertDailyReview(review: DailyReview): Promise<DailyReview>;
  writeEvent(event: OperatorWorkEvent): Promise<void>;
}
