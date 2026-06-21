# Project Progress

Status: draft
Module ID: `project-progress`
Mount: `/project-progress`

## Summary
Project progress timeline, worker access grants, media metadata, comments, and public customer snapshots.

## Dependencies
- none

Optional integrations:

- auth
- customer
- file-media
- email
- notifications-inapp
- audit-log

## Permissions
- project-progress.read
- project-progress.write
- project-progress.admin
- project-progress.extend
- project-progress.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- project_progress_projects
- project_progress_access
- project_progress_logs
- project_progress_media_files
- project_progress_comments
- domain_events

## RPC
- `createProject` with `project-progress.write`
- `updateProjectStatus` with `project-progress.write`
- `createProgressLog` with `project-progress.write`
- `grantProjectAccess` with `project-progress.admin`
- `getProjectSnapshot` with `project-progress.read`
- `resolvePublicProject` public customer snapshot lookup

## Hooks
- beforeProjectCreate
- beforeProgressLogCreate
- afterProgressLogCreated
- afterCommentCreated

## Events
Emits:

- project-progress.created
- project-progress.updated
- project-progress.project.created
- project-progress.project.status-changed
- project-progress.access.granted
- project-progress.access.revoked
- project-progress.log.created
- project-progress.media.attached
- project-progress.comment.created

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- PII fields
- public access tokens
- media upload integration
- production deploy behavior
- external side effects

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
