export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS estimate_quotes",
    "Estimate Quote module migration owns estimate quote documents."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS estimate_quote_lines",
    "Estimate Quote module migration owns estimate quote line items."
  );
}
