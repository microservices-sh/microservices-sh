---
name: notifications-inapp-operator
description: Use when operating in-app notifications, unread counts, user feeds, or notification support triage.
---

# In-App Notifications Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Inspect user and tenant context before reading notification feeds.
3. Ask for approval before creating notifications or marking notifications read on a user's behalf.
4. Record customer-visible support actions through audit-log when available.

Safe defaults:

- Treat notification payloads as customer-visible and potentially sensitive.
- Do not create customer-visible notifications without approval.
