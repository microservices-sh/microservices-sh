# Scheduled work (holds + reminders)

The app runs two periodic jobs: **expire stale slot holds** and **send due
booking reminders**. Both are driven by one idempotent endpoint:

```
POST /api/cron/run            # expires holds + sends due reminders
POST /api/holds/expire        # holds only
```

These endpoints are **fail-closed**: they require `CRON_TOKEN` to be set and a
matching `Authorization: Bearer <CRON_TOKEN>` header (constant-time compared). If
`CRON_TOKEN` is unset they return 401 — there is no open-by-default mode. For
local dev, put `CRON_TOKEN=...` in `.dev.vars`. Reminders are de-duped via the
`booking_reminders` table, so repeated calls are safe.

## Wiring on Cloudflare

Cloudflare Cron Triggers invoke a Worker's `scheduled()` handler — they cannot
hit a route directly. Two options:

1. **External scheduler** (simplest): any cron service POSTs to
   `https://your-app/api/cron/run` with the bearer token every ~15 min.
2. **Native `scheduled()` worker**: add a small worker wrapper that re-exports
   the SvelteKit fetch handler and adds a `scheduled()` handler which calls the
   same logic (`expireHolds` + `sendDueReminders`), then add a cron trigger:

   ```jsonc
   // wrangler.jsonc
   "triggers": { "crons": ["*/15 * * * *"] }
   ```

The endpoint exists so the logic is testable and reusable regardless of which
scheduling path you choose. The `scheduled()` wrapper is intentionally left to
the operator (the SvelteKit Cloudflare adapter doesn't emit one by default).

## Email provider

Reminders/confirmations send via the email module. Set `RESEND_API_KEY` (+ optional
`EMAIL_FROM`) for real delivery; without it a console provider logs instead, so
dev works with no keys.
