import { listFocusBlocksInputSchema } from "../schemas";
import type { OperatorWorkStore } from "../ports";

export async function listFocusBlocks(input: unknown, deps: { store: OperatorWorkStore }) {
  const parsed = listFocusBlocksInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_FOCUS_BLOCK_LIST_INPUT",
        message: "Focus block list input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const blocks = await deps.store.listFocusBlocks(parsed.data);
  return { ok: true as const, status: 200 as const, data: { blocks } };
}
