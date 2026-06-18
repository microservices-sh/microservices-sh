import { operatorWorkbenchInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";
import type { OperatorWorkbench } from "../types";

export async function getOperatorWorkbench(input: unknown, deps: { store: OperatorWorkStore }) {
  const parsed = operatorWorkbenchInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_OPERATOR_WORKBENCH_INPUT",
        message: "Workbench input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const [tasks, focusBlocks, reviews] = await Promise.all([
    deps.store.listTasks({ orgId: parsed.data.orgId, limit: 100 }),
    deps.store.listFocusBlocks({ orgId: parsed.data.orgId, date: parsed.data.date, limit: 100 }),
    deps.store.listDailyReviews({ orgId: parsed.data.orgId, limit: 30 })
  ]);

  const workbench: OperatorWorkbench = {
    tasks,
    focusBlocks,
    reviews,
    summary: {
      openTaskCount: tasks.filter((task) => task.status !== "done").length,
      highPriorityTaskCount: tasks.filter((task) => task.priority === "High" && task.status !== "done").length,
      focusBlockCount: focusBlocks.length,
      savedReviewCount: reviews.filter((review) => review.status === "saved").length,
      latestReview: reviews[0] ?? null
    }
  };

  return { ok: true as const, status: 200 as const, data: workbench };
}
