# File & Media

Status: available
Module ID: `file-media`
Mount: `/files`

## Summary
R2-backed file uploads with tenant-scoped keys, optional owner-scoped listing,
validated upload tickets, completion checks, orphan cleanup, and soft-deletes.
Image variants can fan out through jobs-workflows.

## Dependencies
- none

Optional integrations:

- auth
- audit-log
- jobs-workflows

## Permissions
- media.upload
- media.read
- media.admin
- media.extend
- media.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)
- R2 (`MEDIA_BUCKET`)

Tables:

- media_files
- upload_tickets

## Hooks
- beforeUpload
- allowContentType
- onFileUploaded

## Events
Emits:

- media.upload_requested
- media.uploaded
- media.deleted
- media.ticket_expired

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- object deletion
- production deploy behavior

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
