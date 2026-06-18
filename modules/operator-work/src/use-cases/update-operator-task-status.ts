import { updateOperatorTaskStatusInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";
import { nowIso } from "./utils";

export async function updateOperatorTaskStatus(
  input: unknown,
  deps: {
    store: OperatorWorkStore;
    now?: () => number;
  }
) {
  const parsed = updateOperatorTaskStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_OPERATOR_TASK_STATUS_INPUT",
        message: "Task status input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const updatedAt = nowIso(deps.now);
  const task = await deps.store.updateTaskStatus({
    orgId: parsed.data.orgId,
    taskId: parsed.data.taskId,
    status: parsed.data.status,
    updatedBy: parsed.data.actorId ?? null,
    updatedAt
  });

  if (!task) {
    return {
      ok: false as const,
      status: 404 as const,
      error: { code: "OPERATOR_TASK_NOT_FOUND", message: "Task was not found." }
    };
  }

  await deps.store.writeEvent({
    eventName: "operator-work.task.status_changed",
    entityType: "operator_task",
    entityId: task.id,
    payload: {
      orgId: task.orgId,
      actorId: parsed.data.actorId ?? null,
      source: parsed.data.sourceLabel ?? "operator-work",
      status: task.status
    }
  });

  return { ok: true as const, status: 200 as const, data: { task } };
}
