# File & Media Reference UI

Reference UI is optional host-app code. The module owns upload tickets, media records, owner scoping, and deletion policy.

Admin surface:
- Browse media, inspect ownership, and soft-delete approved files.
- Gate reads with `media.read`; gate deletion with `media.admin`.

Visitor surface:
- Request upload tickets, complete uploads, and list owner-scoped files for authenticated visitors.
- Use the visitor feature key `files`.

Agentic surface:
- Require approval before deletion, retention policy changes, or exposing private object metadata.
