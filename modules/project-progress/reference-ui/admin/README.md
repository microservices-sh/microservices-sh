# Project Progress Admin Reference UI

Recommended admin routes:

- Project list with status, customer, location, expected end date, and latest captured progress.
- Project detail with timeline, media thumbnails from a `file-media`/signed URL adapter, comments, and status actions.
- Worker access panel for granting/revoking `canView` and `canUpload`.
- Progress log form for category, description, captured-at time, voice note key, and media attachment metadata.
- Comment composer for admin/internal responses.

Expected permission: `project-progress.read` for read views, `project-progress.write` for project/log/comment/access mutations, and `project-progress.admin` for access-token or destructive route actions.

Do not put raw upload widgets here unless the template wires a storage/file module. This module stores metadata keys only.
