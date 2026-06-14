# Agent Guide: In-App Notifications Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route
   code in `src/index.ts`, `src/use-cases`, `src/ports`, `src/adapters`, or
   `src/service`.
2. Put persistence behind `NotificationStore`; keep D1 in
   `src/adapters/d1-notification-store.ts`.
3. Per-user, never broadcast. Every notification has a `userId`; every read and
   write takes `userId`. Do not add a "notify all users" path — fan-out is one
   `notify()` call per recipient at the call site.
4. Keep types polymorphic: a `type` discriminator + a JSON `data` payload. Do
   not hardcode a single notification shape; per-type `data` validation belongs
   to the host app.
5. `unreadCount` must count store rows (`readAt IS NULL`), never the length of a
   paginated list — a limit would undercount.
6. Idempotent `notify`: when `dedupKey` is set, check `recordDedupKey` first and
   return the existing notification rather than inserting a duplicate. The
   unique `(user_id, dedup_key)` index backs this.
7. Reconnect support: keep `sinceIso` on `listNotifications` so reconnecting
   clients fetch only what they missed.
8. The realtime WebSocket / Durable Object push layer lives in the host app, not
   here. This module owns persistence + read state only.
9. Treat migrations and production deploy as approval-gated.
10. Run `pnpm --filter @microservices-sh/notifications-inapp build` and
    `pnpm spec:check -- module modules/notifications-inapp` after edits.
