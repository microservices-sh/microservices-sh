# Operator Work Reference UI

Reference UI is optional host-app code. The module owns task boards, focus blocks, daily reviews, and auditable operator workflow state.

Admin surface:
- Show operator workbench, tasks, subtasks, focus blocks, and daily reviews.
- Gate reads with `operator-work.read`; gate changes with `operator-work.write`.

Visitor surface:
- Not applicable.

Agentic surface:
- Read tools: `getOperatorWorkbench`, `listOperatorTasks`, `listFocusBlocks`, `listDailyReviews`.
- Write tools: `upsertOperatorTask`, `updateOperatorTaskStatus`, `upsertFocusBlock`, `saveDailyReview`.
- Require approval before writing tasks, changing status, saving focus blocks, saving reviews, or publishing externally.
