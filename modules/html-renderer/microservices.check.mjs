export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS html_render_documents",
    "HTML Renderer module migration owns render documents."
  );
}
