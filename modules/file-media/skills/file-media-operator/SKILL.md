---
name: file-media-operator
description: Use when managing uploads, media records, owner-scoped files, or media cleanup workflows.
---

# File & Media Operator

Before acting:

1. Confirm tenant and owner scope before listing files.
2. Use upload tickets instead of direct object writes.
3. Ask for approval before deleting files, exposing URLs, changing retention, or running cleanup.
4. Record deletion or retention changes through audit-log when available.

Safe defaults:

- Treat filenames, metadata, and object keys as sensitive.
- Prefer soft-delete over hard-delete.
- Do not bypass content-type validation.
