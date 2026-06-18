import { afterOperatorTaskUpdated, beforeOperatorTaskUpsert } from "../hooks";
import { upsertOperatorTaskInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";
import type { OperatorSubtask, OperatorTask } from "../types";
import { createId, nowIso } from "./utils";

export async function upsertOperatorTask(
  input: unknown,
  deps: {
    store: OperatorWorkStore;
    now?: () => number;
  }
) {
  const parsed = upsertOperatorTaskInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_OPERATOR_TASK_INPUT",
        message: "Task input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const draft = await beforeOperatorTaskUpsert(parsed.data);
  const existing = draft.id ? await deps.store.getTask(draft.orgId, draft.id) : null;
  const timestamp = nowIso(deps.now);
  const taskId = existing?.id ?? draft.id ?? createId("task");
  const subtasks: OperatorSubtask[] = draft.subtasks.map((subtask) => ({
    id: subtask.id ?? createId("sub"),
    taskId,
    text: subtask.text,
    done: subtask.done,
    createdAt: existing?.subtasks.find((item) => item.id === subtask.id)?.createdAt ?? timestamp,
    updatedAt: timestamp
  }));

  const task: OperatorTask = {
    id: taskId,
    orgId: draft.orgId,
    title: draft.title,
    detail: draft.detail,
    status: draft.status,
    category: draft.category,
    priority: draft.priority,
    dueLabel: draft.dueLabel,
    source: draft.source,
    createdBy: existing?.createdBy ?? draft.actorId ?? null,
    updatedBy: draft.actorId ?? existing?.updatedBy ?? null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    subtasks
  };

  const saved = await deps.store.upsertTask(task);
  await deps.store.writeEvent({
    eventName: "operator-work.task.upserted",
    entityType: "operator_task",
    entityId: saved.id,
    payload: {
      orgId: saved.orgId,
      actorId: draft.actorId ?? null,
      source: draft.sourceLabel ?? draft.source,
      status: saved.status
    }
  });

  await afterOperatorTaskUpdated({ task: saved, created: !existing });

  return { ok: true as const, status: existing ? 200 as const : 201 as const, data: { task: saved, created: !existing } };
}
