# Project Progress Visitor Reference UI

Visitor UI is applicable for customer-facing project snapshots resolved by access token.

Recommended visitor routes:

- Public project status page showing title, status, location, dates, and timeline.
- Timeline grouped by captured date and category.
- Media gallery fed by signed URLs from a storage adapter; never expose raw storage keys directly.
- Customer comment form when the route adapter has authenticated or token-gated the visitor.

Route adapters must treat access tokens as sensitive bearer secrets and should add rate limiting, token rotation, and optional customer login before production exposure.
