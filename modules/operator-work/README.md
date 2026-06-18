# Operator Work Module

Status: `draft`

Agent-readable task board, focus plan, and daily review state for DOT AI OS.

## Public Surface

```ts
import {
  getOperatorWorkbench,
  listOperatorTasks,
  upsertOperatorTask,
  updateOperatorTaskStatus,
  listFocusBlocks,
  upsertFocusBlock,
  listDailyReviews,
  saveDailyReview
} from "@microservices-sh/operator-work";
```

## Ownership Boundary

The module owns task/focus/review domain behavior, schemas, ports, adapters, events, permissions, and migrations.

Templates own route adapters, UI layout, org authorization, and framework-specific response mapping.

External side effects stay outside this module until explicit approval gates are added for provider calls, calendar write-back, customer communications, and publishing.
