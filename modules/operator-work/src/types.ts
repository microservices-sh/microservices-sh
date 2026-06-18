export type OperatorTaskStatus = "todo" | "in-progress" | "done";
export type OperatorTaskPriority = "High" | "Medium" | "Low";
export type OperatorTaskSource = "manual" | "agent" | "calendar" | "inbox";
export type FocusBlockSource = "manual" | "ai-draft" | "calendar";
export type FocusEnergy = "Deep" | "Review" | "Comms" | "Admin" | "Close";
export type DailyReviewStatus = "draft" | "saved";

export interface Actor {
  id: string;
  email?: string;
}

export interface OperatorSubtask {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorTask {
  id: string;
  orgId: string;
  title: string;
  detail: string;
  status: OperatorTaskStatus;
  category: string;
  priority: OperatorTaskPriority;
  dueLabel: string;
  source: OperatorTaskSource;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: OperatorSubtask[];
}

export interface FocusBlock {
  id: string;
  orgId: string;
  date: string;
  timeRange: string;
  title: string;
  energy: FocusEnergy;
  note: string;
  source: FocusBlockSource;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReview {
  id: string;
  orgId: string;
  date: string;
  shipped: string;
  openLoops: string;
  agentHandoffs: string;
  tomorrowFirstMove: string;
  markdown: string;
  status: DailyReviewStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorWorkEvent {
  eventName:
    | "operator-work.task.upserted"
    | "operator-work.task.status_changed"
    | "operator-work.focus_block.upserted"
    | "operator-work.daily_review.saved";
  entityType: "operator_task" | "operator_focus_block" | "operator_daily_review";
  entityId: string;
  payload: Record<string, unknown>;
}

export interface OperatorWorkbench {
  tasks: OperatorTask[];
  focusBlocks: FocusBlock[];
  reviews: DailyReview[];
  summary: {
    openTaskCount: number;
    highPriorityTaskCount: number;
    focusBlockCount: number;
    savedReviewCount: number;
    latestReview: DailyReview | null;
  };
}
