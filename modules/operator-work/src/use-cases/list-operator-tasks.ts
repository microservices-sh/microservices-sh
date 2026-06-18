import { listOperatorTasksInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";

export async function listOperatorTasks(input: unknown, deps: { store: OperatorWorkStore }) {
  const parsed = listOperatorTasksInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_OPERATOR_TASK_LIST_INPUT",
        message: "Task list input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const tasks = await deps.store.listTasks(parsed.data);
  return { ok: true as const, status: 200 as const, data: { tasks } };
}
