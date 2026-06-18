# Admin Shell Reference UI

Reference UI is optional host-app code. The module owns schema-driven resource operations; the host owns navigation and component implementation.

Admin surface:
- Render resource lists, detail views, forms, filters, and destructive-action confirmation dialogs.
- Gate access with `admin.access`; gate mutations with `admin.write`.

Visitor surface:
- Not applicable.

Agentic surface:
- Require approval before creates, updates, deletes, permission changes, or bulk actions.
