import { listDailyReviewsInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";

export async function listDailyReviews(input: unknown, deps: { store: OperatorWorkStore }) {
  const parsed = listDailyReviewsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_DAILY_REVIEW_LIST_INPUT",
        message: "Daily review list input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const reviews = await deps.store.listDailyReviews(parsed.data);
  return { ok: true as const, status: 200 as const, data: { reviews } };
}
