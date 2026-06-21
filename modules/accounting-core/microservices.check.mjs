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
  assertFileIncludesAll(
    "migrations/0004_accounting_settings.sql",
    ["CREATE TABLE IF NOT EXISTS accounting_settings", "default_ar_account_id", "default_ap_account_id", "default_income_account_id"],
    "Accounting Core persists source-style accounting setup settings and default account IDs."
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
      "generalLedgerSchema",
      "accountingSettingsSchema",
      "closeFiscalPeriod",
      "getGeneralLedger",
      "getFiscalPeriod",
      "listFiscalPeriods",
      "lockFiscalPeriod",
      "reopenFiscalPeriod",
      "updateAccountingSettings",
      "./use-cases/close-fiscal-period",
      "./use-cases/get-general-ledger",
      "./use-cases/get-fiscal-period",
      "./use-cases/list-fiscal-periods",
      "./use-cases/lock-fiscal-period",
      "./use-cases/reopen-fiscal-period"
    ],
    "Accounting Core exports tenant-scoped settings, fiscal-period read, and lifecycle transition use cases and schemas."
  );
  assertFileIncludesAll(
    "src/schemas.ts",
    [
      "chartOfAccountsStandardSchema = z.enum([\"gaap\", \"ifrs\"])",
      "currency: z.string().min(3).max(3).default(\"USD\")",
      "accountingSettingsSchema",
      "defaultArAccountId",
      "defaultApAccountId",
      "defaultIncomeAccountId"
    ],
    "Accounting Core setup schema accepts GAAP/IFRS chart seed standards, base currency, and default account settings."
  );
  assertFileIncludesAll(
    "src/use-cases/setup-accounting.ts",
    [
      "IFRS_CHART",
      "Non-Current Assets",
      "Property, Plant and Equipment",
      "baseCurrency",
      "DEFAULT_ACCOUNT_CODES",
      "updateAccountingSettings",
      "defaultArAccountId",
      "defaultApAccountId",
      "defaultIncomeAccountId",
      "DEFAULT_ACCOUNT_TYPE_MISMATCH"
    ],
    "Accounting Core setup use case carries source-parity IFRS chart seed, base-currency status metadata, and persisted default account settings."
  );
  assertFileIncludesAll(
    "src/manifest/index.ts",
    [
      "accounting-core.getGeneralLedger",
      "accounting-core.getFiscalPeriod",
      "accounting-core.updateAccountingSettings",
      "accounting-core.listFiscalPeriods",
      "accounting-core.closeFiscalPeriod",
      "accounting-core.lockFiscalPeriod",
      "accounting-core.reopenFiscalPeriod"
    ],
    "Accounting Core manifest exposes settings, fiscal-period read, and lifecycle tools to agentic surfaces."
  );
  assertFileIncludesAll(
    "module.json",
    [
      "accounting-core.getGeneralLedger",
      "accounting-core.getFiscalPeriod",
      "accounting-core.updateAccountingSettings",
      "accounting-core.listFiscalPeriods",
      "accounting-core.closeFiscalPeriod",
      "accounting-core.lockFiscalPeriod",
      "accounting-core.reopenFiscalPeriod"
    ],
    "Accounting Core module metadata exposes settings, fiscal-period read, and lifecycle tools."
  );
  assertFileIncludesAll(
    "openapi.json",
    [
      "\"ChartOfAccountsStandard\"",
      "\"gaap\", \"ifrs\"",
      "\"/general-ledger\"",
      "\"operationId\": \"getGeneralLedger\"",
      "\"/settings\"",
      "\"operationId\": \"updateAccountingSettings\"",
      "\"AccountingSettings\"",
      "\"/fiscal-periods\"",
      "\"operationId\": \"listFiscalPeriods\"",
      "\"/fiscal-periods/{id}\"",
      "\"operationId\": \"getFiscalPeriod\"",
      "\"operationId\": \"closeFiscalPeriod\"",
      "\"operationId\": \"lockFiscalPeriod\"",
      "\"operationId\": \"reopenFiscalPeriod\""
    ],
    "Accounting Core OpenAPI documents settings, fiscal-period list, detail, and lifecycle transition operations."
  );
  assertFileIncludesAll(
    "src/ports/index.ts",
    ["getAccountingSettings", "upsertAccountingSettings", "AccountingSettings"],
    "Accounting Core store port exposes tenant-scoped setup settings persistence."
  );
  assertFileIncludesAll(
    "src/adapters/d1-accounting-core-store.ts",
    ["accounting_settings", "ON CONFLICT(tenant_id)", "rowToAccountingSettings"],
    "Accounting Core D1 adapter persists accounting settings with an upsert."
  );
  assertFileIncludesAll(
    "src/adapters/memory-accounting-core-store.ts",
    ["settingsByTenant", "getAccountingSettings", "upsertAccountingSettings"],
    "Accounting Core memory adapter mirrors tenant-scoped accounting settings persistence."
  );
  assertFileIncludesAll(
    "src/use-cases/get-general-ledger.ts",
    [
      "generalLedgerSchema",
      "listGeneralLedgerPostings",
      "runningBalanceCents",
      "openingBalanceCents",
      "accounting-core.INVALID_GENERAL_LEDGER_INPUT"
    ],
    "Accounting Core general ledger use case validates account/date filters and returns opening/running balances."
  );
  assertFileIncludesAll(
    "src/ports/index.ts",
    ["listGeneralLedgerPostings", "GeneralLedgerFilter", "GeneralLedgerPosting"],
    "Accounting Core store port exposes source-style general ledger postings."
  );
  assertFileIncludesAll(
    "src/adapters/d1-accounting-core-store.ts",
    ["listGeneralLedgerPostings", "e.status IN ('posted', 'void')", "ORDER BY e.entry_date ASC, e.id ASC"],
    "Accounting Core D1 adapter reads posted/void general ledger rows by account and date."
  );
  assertFileIncludesAll(
    "src/adapters/memory-accounting-core-store.ts",
    ["listGeneralLedgerPostings", "generalLedgerEntryVisible", "lineDescription"],
    "Accounting Core memory adapter mirrors source-style general ledger row filtering."
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
