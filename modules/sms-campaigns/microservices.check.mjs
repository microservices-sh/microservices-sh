export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS sms_contacts",
    "SMS Campaigns module migration owns opted-in contacts."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS sms_provider_configs",
    "SMS Campaigns module migration owns provider configuration."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS sms_campaign_recipients",
    "SMS Campaigns module migration owns campaign recipients."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_sms_delivery_logs_vendor_message",
    "SMS Campaigns module indexes vendor delivery callback lookup."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "no_opted_in_contacts",
    "SMS Campaigns module blocks sends without opted-in recipients."
  );
}
