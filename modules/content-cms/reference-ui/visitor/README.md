# Content CMS Visitor Reference UI

Visitor-facing templates can read content through route adapters built on `getEntrySnapshot`.

Recommended visitor behaviors:

- Resolve published content by app-specific slug or route lookup.
- Ask the service for a snapshot and optional locale overlay.
- Render only fields that the template understands.
- Keep preview/draft access behind authenticated admin routes.

This module does not include a public renderer, routing table, CDN policy, or R2 upload handling. Those belong in templates or companion modules.
