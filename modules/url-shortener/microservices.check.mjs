export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS url_short_links",
    "URL Shortener module migration owns links."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS url_short_link_clicks",
    "URL Shortener module migration owns click analytics."
  );
}
