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
      "getFiscalPeriod",
      "listFiscalPeriods",
      "./use-cases/get-fiscal-period",
      "./use-cases/list-fiscal-periods"
    ],
    "Accounting Core exports tenant-scoped fiscal-period read use cases and schema."
  );
  assertFileIncludesAll(
    "src/manifest/index.ts",
    ["accounting-core.getFiscalPeriod", "accounting-core.listFiscalPeriods"],
    "Accounting Core manifest exposes fiscal-period read tools to agentic surfaces."
  );
  assertFileIncludesAll(
    "module.json",
    ["accounting-core.getFiscalPeriod", "accounting-core.listFiscalPeriods"],
    "Accounting Core module metadata exposes fiscal-period read tools."
  );
  assertFileIncludesAll(
    "openapi.json",
    ["\"/fiscal-periods\"", "\"operationId\": \"listFiscalPeriods\"", "\"/fiscal-periods/{id}\"", "\"operationId\": \"getFiscalPeriod\""],
    "Accounting Core OpenAPI documents fiscal-period list and detail reads."
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
}
