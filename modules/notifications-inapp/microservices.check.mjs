export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_notifications_inapp.sql",
    "CREATE TABLE IF NOT EXISTS notifications",
    "Notifications module migration owns the notifications table."
  );
  assertFileIncludes(
    "migrations/0001_notifications_inapp.sql",
    "idx_notifications_user_dedup",
    "Idempotent notify relies on a unique (user_id, dedup_key) index."
  );
  assertFileIncludes(
    "src/ports/index.ts",
    "unreadCount(userId: string)",
    "NotificationStore exposes an accurate user-scoped unreadCount."
  );
  assertFileIncludes(
    "src/use-cases/notify.ts",
    "recordDedupKey",
    "notify dedupes on dedupKey before inserting a duplicate notification."
  );
}
