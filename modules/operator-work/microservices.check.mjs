export default function check({ assertFileIncludes, assertFileIncludesAll }) {
  assertFileIncludesAll(
    "migrations/0001_operator_work.sql",
    ["CREATE TABLE IF NOT EXISTS operator_tasks", "CREATE TABLE IF NOT EXISTS operator_daily_reviews"],
    "Operator Work module migration owns task and daily review tables."
  );
  assertFileIncludes(
    "src/ports/index.ts",
    "interface OperatorWorkStore",
    "Operator Work persistence is behind the OperatorWorkStore port."
  );
}
