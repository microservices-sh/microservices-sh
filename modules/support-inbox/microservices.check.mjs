export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS support_inbox_widget_settings",
    "Support Inbox module migration owns widget settings."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS support_inbox_conversations",
    "Support Inbox module migration owns conversations."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS support_inbox_messages",
    "Support Inbox module migration owns messages."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "access_token_ref",
    "Support Inbox stores channel secret references instead of raw provider tokens."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "agent_takeover_active",
    "Support Inbox pauses assistant replies during agent takeover."
  );
}
