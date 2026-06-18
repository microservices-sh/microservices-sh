import { afterFocusBlockUpdated, beforeFocusBlockUpsert } from "../hooks";
import { upsertFocusBlockInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";
import type { FocusBlock } from "../types";
import { createId, nowIso } from "./utils";

export async function upsertFocusBlock(
  input: unknown,
  deps: {
    store: OperatorWorkStore;
    now?: () => number;
  }
) {
  const parsed = upsertFocusBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_FOCUS_BLOCK_INPUT",
        message: "Focus block input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const draft = await beforeFocusBlockUpsert(parsed.data);
  const existing = draft.id ? await deps.store.getFocusBlock(draft.orgId, draft.id) : null;
  const timestamp = nowIso(deps.now);
  const block: FocusBlock = {
    id: existing?.id ?? draft.id ?? createId("focus"),
    orgId: draft.orgId,
    date: draft.date,
    timeRange: draft.timeRange,
    title: draft.title,
    energy: draft.energy,
    note: draft.note,
    source: draft.source,
    createdBy: existing?.createdBy ?? draft.actorId ?? null,
    updatedBy: draft.actorId ?? existing?.updatedBy ?? null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };

  const saved = await deps.store.upsertFocusBlock(block);
  await deps.store.writeEvent({
    eventName: "operator-work.focus_block.upserted",
    entityType: "operator_focus_block",
    entityId: saved.id,
    payload: {
      orgId: saved.orgId,
      actorId: draft.actorId ?? null,
      source: draft.sourceLabel ?? draft.source,
      date: saved.date
    }
  });

  await afterFocusBlockUpdated({ block: saved, created: !existing });

  return { ok: true as const, status: existing ? 200 as const : 201 as const, data: { block: saved, created: !existing } };
}
