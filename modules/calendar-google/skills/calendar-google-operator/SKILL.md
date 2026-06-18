---
name: calendar-google-operator
description: Use when managing Google Calendar sync, OAuth token refresh, watch channels, or calendar event ingestion.
---

# Google Calendar Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Inspect connection, token, sync token, and channel state before external calls.
3. Ask for approval before connecting calendars, syncing, refreshing tokens, or renewing watch channels.
4. Use audit-log for external calendar side effects when available.

Safe defaults:

- Treat event titles, attendees, and notes as sensitive.
- Do not expose OAuth tokens or refresh-token state beyond operational summaries.
