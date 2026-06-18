import { beforeDailyReviewSave } from "../hooks";
import { saveDailyReviewInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";
import type { DailyReview } from "../types";
import { createId, markdownFromReview, nowIso } from "./utils";

export async function saveDailyReview(
  input: unknown,
  deps: {
    store: OperatorWorkStore;
    now?: () => number;
  }
) {
  const parsed = saveDailyReviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_DAILY_REVIEW_INPUT",
        message: "Daily review input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const markdown = parsed.data.markdown || markdownFromReview(parsed.data);
  const draft = await beforeDailyReviewSave({ ...parsed.data, markdown });
  const existing = await deps.store.getDailyReview(draft.orgId, draft.date);
  const timestamp = nowIso(deps.now);
  const review: DailyReview = {
    id: existing?.id ?? draft.id ?? createId("review"),
    orgId: draft.orgId,
    date: draft.date,
    shipped: draft.shipped,
    openLoops: draft.openLoops,
    agentHandoffs: draft.agentHandoffs,
    tomorrowFirstMove: draft.tomorrowFirstMove,
    markdown: draft.markdown,
    status: draft.status,
    createdBy: existing?.createdBy ?? draft.actorId ?? null,
    updatedBy: draft.actorId ?? existing?.updatedBy ?? null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };

  const saved = await deps.store.upsertDailyReview(review);
  await deps.store.writeEvent({
    eventName: "operator-work.daily_review.saved",
    entityType: "operator_daily_review",
    entityId: saved.id,
    payload: {
      orgId: saved.orgId,
      actorId: draft.actorId ?? null,
      source: draft.sourceLabel ?? "operator-work",
      date: saved.date,
      status: saved.status
    }
  });

  return { ok: true as const, status: existing ? 200 as const : 201 as const, data: { review: saved, created: !existing } };
}
