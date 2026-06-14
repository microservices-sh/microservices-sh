export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_file_media.sql",
    "CREATE TABLE IF NOT EXISTS media_files",
    "File-media migration owns the media_files table."
  );
  assertFileIncludes(
    "src/keys.ts",
    "buildObjectKey",
    "Object keys are built through a single tenant-scoped helper."
  );
  assertFileIncludes(
    "src/use-cases/complete-upload.ts",
    "head",
    "completeUpload verifies the object exists (and its size) before recording it."
  );
  assertFileIncludes(
    "src/use-cases/expire-stale-tickets.ts",
    "expireStaleTickets",
    "Stale upload tickets are cleaned up so R2 does not accumulate orphans."
  );
}
