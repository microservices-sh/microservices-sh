# Operator Work

Status: draft
Module ID: `operator-work`
Mount: `/operator-work`

## Summary
Agent-readable operator work state for DOT AI OS: task board, subtasks, focus blocks, daily reviews, and auditable work history.

## Dependencies
- org-team-rbac

Optional integrations:

- audit-log
- jobs-workflows
- calendar-google
- email

## Permissions
- operator-work.read
- operator-work.write
- operator-work.admin
- operator-work.extend
- operator-work.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- operator_tasks
- operator_subtasks
- operator_focus_blocks
- operator_daily_reviews
- domain_events

## Hooks
- beforeOperatorTaskUpsert
- afterOperatorTaskUpdated
- beforeFocusBlockUpsert
- beforeDailyReviewSave

## Events
Emits:

- operator-work.task.upserted
- operator-work.task.status_changed
- operator-work.focus_block.upserted
- operator-work.daily_review.saved

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- AI provider calls
- calendar write-back
- customer communications
- production deploy behavior
- external publishing

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
