---
name: operator-work-operator
description: Use when managing operator tasks, focus plans, daily reviews, or agentic work state.
---

# Operator Work Operator

Before acting:

1. Use read tools first: `operator-work.getOperatorWorkbench`, `operator-work.listOperatorTasks`, `operator-work.listFocusBlocks`, and `operator-work.listDailyReviews`.
2. Ask for approval before write tools: `operator-work.upsertOperatorTask`, `operator-work.updateOperatorTaskStatus`, `operator-work.upsertFocusBlock`, and `operator-work.saveDailyReview`.
3. Keep generated plans traceable to task IDs, focus block IDs, review dates, `actorId`, and `sourceLabel`.
4. Record important workflow mutations through audit-log when available.

Safe defaults:

- Do not overwrite user-authored task notes without confirmation.
- Prefer explicit task status transitions.
- Leave buffer in AI-generated focus plans instead of filling the whole day.
- Keep calendar writeback and customer communications approval-gated.
