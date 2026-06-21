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
  assertFileIncludesAll(
    "migrations/0003_fiscal_period_metadata.sql",
    ["ADD COLUMN period_type TEXT NOT NULL DEFAULT 'month'", "ADD COLUMN closed_by_id TEXT"],
    "Accounting Core upgrade migration adds source-parity fiscal-period metadata."
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
      "fiscalPeriodTypeSchema",
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
    "src/schemas.ts",
    ["chartOfAccountsStandardSchema = z.enum([\"gaap\", \"ifrs\"])", "currency: z.string().min(3).max(3).default(\"USD\")"],
    "Accounting Core setup schema accepts GAAP/IFRS chart seed standards and base currency."
  );
  assertFileIncludesAll(
    "src/use-cases/setup-accounting.ts",
    ["IFRS_CHART", "Non-Current Assets", "Property, Plant and Equipment", "baseCurrency"],
    "Accounting Core setup use case carries source-parity IFRS chart seed and base-currency status metadata."
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
      "\"ChartOfAccountsStandard\"",
      "\"gaap\", \"ifrs\"",
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
      "closedById",
      "updateFiscalPeriodIfCurrentStatus",
      "accounting-core.FISCAL_PERIOD_TRANSITION_CONFLICT",
      "accounting-core.INVALID_FISCAL_PERIOD_TRANSITION",
      "previousStatus"
    ],
    "Accounting Core fiscal-period status updates enforce source-style open/closed/locked transition rules."
  );
  assertFileIncludesAll(
    "src/ports/index.ts",
    ["updateFiscalPeriodIfCurrentStatus", "expectedStatus"],
    "Accounting Core store port exposes compare-and-set fiscal-period status updates."
  );
  assertFileIncludesAll(
    "src/adapters/d1-accounting-core-store.ts",
    ["AND status = ?", "result.meta?.changes"],
    "Accounting Core D1 fiscal-period lifecycle updates use row-count compare-and-set semantics."
  );
  assertFileIncludesAll(
    "src/adapters/memory-accounting-core-store.ts",
    ["updateFiscalPeriodIfCurrentStatus", "current.status !== expectedStatus"],
    "Accounting Core memory store mirrors fiscal-period compare-and-set semantics."
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
    ["GAAP/IFRS seed packs", "base-currency normalization", "periodType", "closedById", "compare-and-set", "open periods can close", "closed periods can reopen or lock", "locked periods cannot transition"],
    "Accounting Core README documents fiscal-period lifecycle invariants."
  );
  assertFileIncludesAll(
    "llms.txt",
    ["GAAP/IFRS chart seed packs normalize base currency", "compare-and-set fiscal-period writes", "periodType month|quarter|year|custom", "close actor metadata", "open->closed", "closed->open", "closed->locked", "locked periods cannot transition"],
    "Accounting Core LLM notes document fiscal-period lifecycle invariants."
  );
}
