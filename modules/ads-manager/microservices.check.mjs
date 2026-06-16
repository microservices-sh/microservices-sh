export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_ads.sql",
    "CREATE TABLE IF NOT EXISTS ad_insight_snapshots",
    "Ads Manager migration owns the insight-snapshots table."
  );
  assertFileIncludes(
    "src/use-cases/detect-anomalies.ts",
    "spend_spike",
    "Anomaly detection raises typed alerts (spend_spike/cpc_spike/zero_conv)."
  );
  assertFileIncludes(
    "src/use-cases/list-campaigns.ts",
    "entitlement",
    "Paid use-cases are gated by the entitlement check before calling the upstream service."
  );
  assertFileIncludes(
    "src/adapters/openclaw-connector.ts",
    "entitlementToken",
    "The upstream connector forwards the signed entitlement token."
  );
}
