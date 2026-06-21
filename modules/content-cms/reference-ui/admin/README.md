# Content CMS Admin Reference UI

Expected admin surfaces:

- Content type list and editor.
- Field builder for each content type.
- Entry list filtered by content type and status.
- Entry editor that saves drafts as new versions.
- Publish/archive actions with visible version number.
- Locale settings and localization status views.
- Media library metadata list. Actual upload and object storage flows belong to route adapters or `file-media`.

Permissions:

- `content-cms.read` for lists, details, and snapshots.
- `content-cms.write` for definitions, entries, versions, localizations, locales, and media metadata.
- `content-cms.admin` for destructive or schema-changing admin workflows.
