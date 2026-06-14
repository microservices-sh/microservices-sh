export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_forms_intake.sql",
    "CREATE TABLE IF NOT EXISTS forms",
    "Forms-intake migration owns the forms table."
  );
  assertFileIncludes(
    "migrations/0001_forms_intake.sql",
    "CREATE TABLE IF NOT EXISTS form_submissions",
    "Forms-intake migration owns the form_submissions table."
  );
  assertFileIncludes(
    "src/validate-submission.ts",
    "isActive",
    "Submission validation is a pure function that evaluates conditional field visibility (hidden-but-required fields are not required)."
  );
  assertFileIncludes(
    "src/use-cases/submit-form.ts",
    "recordSubmissionKey",
    "Submissions are idempotent so a retried POST is stored exactly once."
  );
  assertFileIncludes(
    "src/use-cases/submit-form.ts",
    "turnstile.verify",
    "Spam protection runs through the injected TurnstileVerifier port, not fetch in the use case."
  );
  assertFileIncludes(
    "src/use-cases/update-form.ts",
    "FORM_NOT_EDITABLE",
    "Only draft forms can be edited; a published form's field set is frozen."
  );
  assertFileIncludes(
    "src/validate-submission.ts",
    "validateAttachment",
    "Attachment references are validated by content-type allowlist + size cap (references only, not bytes)."
  );
}
