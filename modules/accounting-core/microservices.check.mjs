export default function check({ assertFileIncludes, assertFileIncludesAll }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_accounts",
    "Accounting Core module migration owns chart of accounts."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_fiscal_periods",
    "Accounting Core module migration owns fiscal periods."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_journal_entries",
    "Accounting Core module migration owns journal entries."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_journal_lines",
    "Accounting Core module migration owns journal lines."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_accounting_journal_entries_posted_source_ref",
    "Accounting Core module enforces posted source reference idempotency."
  );
  assertFileIncludesAll(
    "src/index.ts",
    [
      "fiscalPeriodIdentitySchema",
      "fiscalPeriodTransitionSchema",
      "closeFiscalPeriod",
      "getFiscalPeriod",
      "listFiscalPeriods",
      "lockFiscalPeriod",
      "reopenFiscalPeriod",
      "./use-cases/close-fiscal-period",
      "./use-cases/get-fiscal-period",
      "./use-cases/list-fiscal-periods",
      "./use-cases/lock-fiscal-period",
      "./use-cases/reopen-fiscal-period"
    ],
    "Accounting Core exports tenant-scoped fiscal-period read and lifecycle transition use cases and schemas."
  );
  assertFileIncludesAll(
    "src/manifest/index.ts",
    [
      "accounting-core.getFiscalPeriod",
      "accounting-core.listFiscalPeriods",
      "accounting-core.closeFiscalPeriod",
      "accounting-core.lockFiscalPeriod",
      "accounting-core.reopenFiscalPeriod"
    ],
    "Accounting Core manifest exposes fiscal-period read and lifecycle tools to agentic surfaces."
  );
  assertFileIncludesAll(
    "module.json",
    [
      "accounting-core.getFiscalPeriod",
      "accounting-core.listFiscalPeriods",
      "accounting-core.closeFiscalPeriod",
      "accounting-core.lockFiscalPeriod",
      "accounting-core.reopenFiscalPeriod"
    ],
    "Accounting Core module metadata exposes fiscal-period read and lifecycle tools."
  );
  assertFileIncludesAll(
    "openapi.json",
    [
      "\"/fiscal-periods\"",
      "\"operationId\": \"listFiscalPeriods\"",
      "\"/fiscal-periods/{id}\"",
      "\"operationId\": \"getFiscalPeriod\"",
      "\"operationId\": \"closeFiscalPeriod\"",
      "\"operationId\": \"lockFiscalPeriod\"",
      "\"operationId\": \"reopenFiscalPeriod\""
    ],
    "Accounting Core OpenAPI documents fiscal-period list, detail, and lifecycle transition operations."
  );
  assertFileIncludesAll(
    "src/use-cases/get-fiscal-period.ts",
    ["fiscalPeriodIdentitySchema", "accountingCoreStore.getFiscalPeriod", "accounting-core.FISCAL_PERIOD_NOT_FOUND"],
    "Accounting Core fiscal-period detail use case validates identity and delegates to the tenant-scoped store."
  );
  assertFileIncludesAll(
    "src/use-cases/list-fiscal-periods.ts",
    ["fiscalPeriodFilterSchema", "accountingCoreStore.listFiscalPeriods"],
    "Accounting Core fiscal-period list use case validates filters and delegates to the tenant-scoped store."
  );
  assertFileIncludesAll(
    "src/use-cases/update-fiscal-period-status.ts",
    [
      "canTransition",
      "open",
      "closed",
      "locked",
      "accounting-core.INVALID_FISCAL_PERIOD_TRANSITION",
      "previousStatus"
    ],
    "Accounting Core fiscal-period status updates enforce source-style open/closed/locked transition rules."
  );
  assertFileIncludesAll(
    "src/use-cases/close-fiscal-period.ts",
    ["fiscalPeriodTransitionSchema", "transitionFiscalPeriodStatus", "status: \"closed\""],
    "Accounting Core closeFiscalPeriod validates transition input and closes through guarded status transitions."
  );
  assertFileIncludesAll(
    "src/use-cases/reopen-fiscal-period.ts",
    ["fiscalPeriodTransitionSchema", "transitionFiscalPeriodStatus", "status: \"open\""],
    "Accounting Core reopenFiscalPeriod validates transition input and reopens through guarded status transitions."
  );
  assertFileIncludesAll(
    "src/use-cases/lock-fiscal-period.ts",
    ["fiscalPeriodTransitionSchema", "transitionFiscalPeriodStatus", "status: \"locked\""],
    "Accounting Core lockFiscalPeriod validates transition input and locks through guarded status transitions."
  );
  assertFileIncludesAll(
    "README.md",
    ["open periods can close", "closed periods can reopen or lock", "locked periods cannot transition"],
    "Accounting Core README documents fiscal-period lifecycle invariants."
  );
  assertFileIncludesAll(
    "llms.txt",
    ["open->closed", "closed->open", "closed->locked", "locked periods cannot transition"],
    "Accounting Core LLM notes document fiscal-period lifecycle invariants."
  );
}
