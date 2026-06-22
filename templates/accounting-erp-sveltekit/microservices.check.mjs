export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists, readText }) {
  const accountsPayableMigration = readText("migrations/0024_accounts_payable.sql");
  const accountsReceivableMigration = readText("migrations/0025_accounts_receivable.sql");
  const bankReconciliationMigration = readText("migrations/0026_bank_reconciliation.sql");
  const accountingFiscalPeriodMetadataMigration = readText("migrations/0030_accounting_fiscal_period_metadata.sql");
  const accountingSettingsMigration = readText("migrations/0031_accounting_settings.sql");
  const accountingDepositSettingsMigration = readText("migrations/0032_accounting_deposit_settings.sql");
  const billDetailServer = readText("src/routes/app/payables/[id]/+page.server.ts");
  const billDetailPage = readText("src/routes/app/payables/[id]/+page.svelte");
  const vendorDetailServer = readText("src/routes/app/payables/vendors/[id]/+page.server.ts");
  const vendorDetailPage = readText("src/routes/app/payables/vendors/[id]/+page.svelte");
  const paymentDetailServer = readText("src/routes/app/payables/payments/[id]/+page.server.ts");
  const paymentDetailPage = readText("src/routes/app/payables/payments/[id]/+page.svelte");
  const recurringBillDetailServer = readText("src/routes/app/payables/recurring/[id]/+page.server.ts");
  const bankingImportDetailServer = readText("src/routes/app/banking/imports/[id]/+page.server.ts");
  const bankingImportDetailPage = readText("src/routes/app/banking/imports/[id]/+page.svelte");
  const bankingReconciliationDetailServer = readText("src/routes/app/banking/reconciliations/[id]/+page.server.ts");
  const bankingReconciliationDetailPage = readText("src/routes/app/banking/reconciliations/[id]/+page.svelte");
  const ledgerAccountDetailServer = readText("src/routes/app/ledger/accounts/[id]/+page.server.ts");
  const ledgerAccountDetailPage = readText("src/routes/app/ledger/accounts/[id]/+page.svelte");
  const ledgerFiscalPeriodDetailServer = readText("src/routes/app/ledger/fiscal-periods/[id]/+page.server.ts");
  const ledgerFiscalPeriodDetailPage = readText("src/routes/app/ledger/fiscal-periods/[id]/+page.svelte");

  assertFileIncludesAll(
    "docs/api-boundary.md",
    ["Use Case Shape", "Route Adapter Shape"],
    "API boundary docs define route adapter and use case shapes."
  );
  assertFileIncludesAll(
    "src/routes/signup/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "createOrganization"],
    "Company setup route stays a thin adapter over org-team-rbac createOrganization."
  );
  assertFileIncludesAll(
    "src/routes/app/settings/team/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "inviteMember", "updateMemberRole"],
    "Team route (Settings hub) uses org-team-rbac invite/role use cases."
  );
  assertFileIncludesAll(
    "src/routes/app/team/accept/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "acceptInvitation"],
    "Invitation accept route uses org-team-rbac acceptInvitation."
  );
  assertFileIncludesAll(
    "src/routes/app/customers/+page.server.ts",
    ["@microservices-sh/customer", "listCustomers"],
    "Customers route uses the customer module list use case."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/+page.server.ts",
    ["@microservices-sh/invoice", "listInvoices"],
    "Invoices route uses the invoice module list use case."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/recurring/+page.server.ts",
    ["listRecurringInvoiceTemplatesScoped", "updateRecurringInvoiceTemplateStatusScoped", "recurringInvoiceStore"],
    "Recurring invoices route uses scoped invoice module recurring use cases."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/recurring/new/+page.server.ts",
    ["createRecurringInvoiceTemplateScoped", "recurringInvoiceStore"],
    "Recurring invoice creation route stays a thin adapter over the invoice module."
  );
  assertFileIncludesAll(
    "src/routes/app/quotes/+page.server.ts",
    ["@microservices-sh/estimate-quote", "createEstimateQuoteService", "prepareInvoiceDraft", "recordEvent"],
    "Quotes route stays a thin adapter over estimate-quote service methods and previews invoice drafts without persisting invoices."
  );
  assertFileIncludesAll(
    "src/lib/server/stores.ts",
    ["createD1EstimateQuoteStore", "createEstimateQuoteMemoryStore", "estimateQuoteStore"],
    "Template wires estimate-quote D1 and memory stores through the server store resolver."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "event.locals.estimateQuoteStore = stores.estimateQuoteStore",
    "Request locals expose the estimate-quote store to route adapters."
  );
  assertFileIncludesAll(
    "migrations/0028_estimate_quote.sql",
    ["CREATE TABLE IF NOT EXISTS estimate_quotes", "CREATE TABLE IF NOT EXISTS estimate_quote_lines"],
    "Template keeps estimate quote tables aligned with the estimate-quote module."
  );
  assertFileIncludes(
    "src/lib/server/erp-nav.ts",
    "\"estimate-quote\": { label: \"Quotes\", href: \"/app/quotes\"",
    "Sidebar exposes the estimate-quote module as a dedicated Quotes billing surface."
  );
  assertFileIncludesAll(
    "src/routes/app/recurring-documents/+page.server.ts",
    [
      "@microservices-sh/recurring-documents",
      "createRecurringDocumentsService",
      "listRecurringDocumentTemplates",
      "getRecurringDocumentStats",
      "createRecurringDocumentTemplate",
      "pauseRecurringDocumentTemplate",
      "resumeRecurringDocumentTemplate",
      "cancelRecurringDocumentTemplate",
      "generateDueRecurringDocuments",
      "recordEvent"
    ],
    "Recurring documents route uses module service APIs for schedule lifecycle and draft generation."
  );
  assertFileIncludesAll(
    "src/lib/server/stores.ts",
    ["createD1RecurringDocumentsStore", "createRecurringDocumentsMemoryStore", "recurringDocumentsStore"],
    "Template wires recurring-documents D1 and memory stores through the server store resolver."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "event.locals.recurringDocumentsStore = stores.recurringDocumentsStore",
    "Request locals expose the recurring-documents store to route adapters."
  );
  assertFileIncludesAll(
    "migrations/0029_recurring_documents.sql",
    ["CREATE TABLE IF NOT EXISTS recurring_document_templates", "CREATE TABLE IF NOT EXISTS recurring_document_lines", "idx_recurring_document_templates_tenant_due"],
    "Template keeps recurring document tables aligned with the recurring-documents module."
  );
  assertFileIncludesAll(
    "src/lib/server/erp-nav.ts",
    ["\"recurring-documents\": { label: \"Schedules\", href: \"/app/recurring-documents\"", "\"estimate-quote\", \"recurring-documents\", \"invoice\""],
    "Sidebar exposes recurring documents as the document schedule surface between quotes and invoices."
  );
  assertFileIncludesAll(
    "migrations/0004_invoice.sql",
    ["CREATE TABLE IF NOT EXISTS invoice_recurring_templates", "idx_invoices_recurring_occurrence"],
    "Template keeps recurring invoice tables and occurrence dedupe index aligned with the invoice module."
  );
  assertFileIncludesAll(
    "src/lib/server/stores.ts",
    ["createD1RecurringInvoiceStore", "createMemoryRecurringInvoiceStore", "recurringInvoiceStore"],
    "Template wires the invoice recurring template store through the server store resolver."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "event.locals.recurringInvoiceStore = stores.recurringInvoiceStore",
    "Request locals expose the recurring invoice store to route adapters."
  );
  assertFileIncludesAll(
    "src/lib/server/stores.ts",
    ["createD1JobRunStore", "createMemoryJobRunStore", "jobRunStore"],
    "Template wires job run storage for due job execution records."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "event.locals.jobRunStore = stores.jobRunStore",
    "Request locals expose the job run store to route adapters."
  );
  assertFileIncludesAll(
    "src/routes/app/jobs/+page.server.ts",
    ["runDueJobs", "createRecurringInvoiceJobHandlers", "jobRunStore", "accountingCoreStore", "accountsReceivableService"],
    "Jobs route can run due jobs through the registered recurring invoice handler with accounting and receivables stores."
  );
  assertFileIncludesAll(
    "src/lib/server/scheduled.ts",
    [
      "dueScheduledJobs",
      "runDueJobs",
      "createRecurringInvoiceJobHandlers",
      "accountingCoreStore",
      "accountsReceivableService",
      "createCfQueueProducer",
      "jobs-workflows.cron_run"
    ],
    "Scheduled runtime catches up recurring schedules and executes due jobs through the same accounting-aware module handlers as the operator UI."
  );
  assertFileIncludesAll(
    "src/hooks.server.ts",
    ["export async function scheduled", "runAccountingScheduled", "ctx.waitUntil"],
    "Cloudflare native cron events are exported from the SvelteKit Worker hook."
  );
  assertFileIncludesAll(
    "src/routes/api/cron/run/+server.ts",
    ["CRON_TOKEN", "authorization", "runAccountingScheduled", "enqueued", "ran"],
    "HTTP cron fallback is bearer-token gated and uses the same scheduled runner."
  );
  assertFileIncludesAll(
    "scripts/inject-scheduled.mjs",
    ["_worker.js", "__combined_worker", "scheduled", "as default"],
    "Post-build script merges the scheduled handler into the Cloudflare Worker default export."
  );
  assertFileIncludesAll(
    "package.json",
    ["postbuild", "scripts/inject-scheduled.mjs", "postbuild:app"],
    "Template build runs the scheduled-handler injector after Cloudflare output is generated."
  );
  assertFileIncludes(
    "src/lib/server/recurring-invoice-jobs.ts",
    "invoice.recurring.generate_due",
    "Template registers the recurring invoice generate-due job handler."
  );
  assertFileIncludesAll(
    "src/lib/server/recurring-invoice-jobs.ts",
    ["postIssuedInvoiceToAccounting", "syncInvoiceToReceivables", "accountsReceivableService", "accountingCoreStore"],
    "Recurring invoice jobs post and sync auto-issued generated invoices through the accounting and receivables adapters."
  );
  assertFileIncludesAll(
    "src/routes/app/files/+page.server.ts",
    ["@microservices-sh/file-media", "listFiles"],
    "Files route uses the file-media module list use case."
  );
  assertFileIncludesAll(
    "src/routes/app/+layout.server.ts",
    ["@microservices-sh/org-team-rbac", "resolvePermissions", "buildNav"],
    "The /app layer gates membership through org-team-rbac and builds the lock-driven nav."
  );
  assertFileIncludesAll(
    "src/lib/server/erp-nav.ts",
    ["enabledModuleIds", "buildNav"],
    "Sidebar nav is derived from the enabled module set."
  );
  assertFileIncludesAll(
    "src/lib/server/modules.ts",
    ["microservices.lock.json", "ENABLED_MODULES", "requireModule"],
    "Module enablement reads the lockfile + ENABLED_MODULES and guards routes with requireModule."
  );
  assertFileIncludesAll(
    "src/routes/admin/[resource]/+page.server.ts",
    ["@microservices-sh/admin-shell", "listRecords"],
    "Super-admin route uses admin-shell listRecords over the table gateway."
  );
  assertFileIncludes(
    "migrations/0002_org_team_rbac.sql",
    "idx_memberships_org_user",
    "Template keeps the org-team-rbac per-(org,user) membership uniqueness index."
  );
  assertFileIncludesAll(
    "migrations/0025_accounts_receivable.sql",
    ["CREATE TABLE IF NOT EXISTS ar_invoice_snapshots", "unapplied_cents INTEGER NOT NULL DEFAULT 0", "journal_entry_id TEXT"],
    "Template keeps Accounts Receivable D1 schema aligned with invoice snapshots, unapplied balances, and accounting journal references."
  );
  assertFileIncludesAll(
    "migrations/0001_core.sql",
    ["CREATE TABLE IF NOT EXISTS domain_events", "event_name TEXT NOT NULL", "entity_type TEXT NOT NULL", "entity_id TEXT NOT NULL"],
    "Core migration owns the shared domain_events schema used by accounting module D1 stores."
  );
  assert(
    !accountsPayableMigration.includes("CREATE TABLE IF NOT EXISTS domain_events") &&
      !accountsReceivableMigration.includes("CREATE TABLE IF NOT EXISTS domain_events") &&
      !bankReconciliationMigration.includes("CREATE TABLE IF NOT EXISTS domain_events"),
    "Accounting AP, AR, and bank migrations do not redeclare the core-owned domain_events table.",
    "policy:accounting-no-domain-events-redeclare"
  );
  assertFileIncludesAll(
    "src/lib/server/stores.ts",
    ["accountsReceivableStore", "createD1AccountsReceivableStore", "createAccountsReceivableMemoryStore"],
    "Template exposes the Accounts Receivable store so request-scoped services can attach accounting posters."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "event.locals.accountsReceivableStore = stores.accountsReceivableStore",
    "Request locals expose the Accounts Receivable store for actor-aware settlement workflows."
  );
  assertFileIncludesAll(
    "src/lib/server/accounts-receivable-accounting.ts",
    ["postIssuedInvoiceToAccounting", "createAccountsReceivableAccountingPoster", "\"1200\"", "\"4100\"", "defaultDepositAccount", "defaultDepositAccountId", "postAccountsReceivablePayment"],
    "Accounting template posts issued invoices and applied customer payments into accounting-core journals."
  );
  assertFileIncludesAll(
    "src/lib/server/accounts-receivable-sync.ts",
    ["upsertInvoiceSnapshot", "invoice.status === \"draft\"", "amountDueCents = status === \"void\" ? 0"],
    "Template synchronizes issued, paid, and voided invoice lifecycle state into Accounts Receivable snapshots."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/[id]/+page.server.ts",
    ["syncInvoiceToReceivables", "recordPaymentScoped", "voidInvoiceScoped", "recordCustomerPayment", "applyCustomerPayment", "createAccountsReceivableAccountingPoster"],
    "Invoice detail payments post through Accounts Receivable settlement before refreshing invoice snapshots; voids still refresh the snapshot."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/[id]/+page.server.ts",
    ["createInvoicePaymentLinkScoped", "sendEmail", "buildInvoiceEmail", "invoice.sent"],
    "Invoice detail can create payment links and send invoice emails through module ports."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/[id]/+page.svelte",
    ["Payment link", "Send invoice", "Create link + send", "Open payment link", "paymentKey"],
    "Invoice detail page exposes payment-link, send-invoice, and idempotent payment controls."
  );
  assertFileIncludesAll(
    "src/hooks.server.ts",
    ["createStripeInvoicePaymentLinkProvider", "createMemoryInvoicePaymentLinkProvider", "getEmailDeps", "invoicePaymentLinkProvider", "emailProvider"],
    "Request locals wire Stripe/memory invoice payment links and transactional email providers for invoice collection workflows."
  );
  assertFileIncludesAll(
    "microservices.lock.json",
    ["\"id\": \"email\"", "\"email.write\"", "\"beforeEmailSend\""],
    "Accounting template lock includes the email module used by login and invoice collection workflows."
  );
  assertFileIncludesAll(
    "src/routes/api/payments/stripe-webhook/+server.ts",
    ["request.text()", "verifyWebhookSignature", "parseStripeInvoiceSettlementEvent", "getAccountingSettings", "stripeDepositAccountId", "depositAccountId", "recordCustomerPayment", "applyCustomerPayment", "recordPaymentScoped", "syncInvoiceToReceivables", "stripe-signature"],
    "Stripe webhook route verifies raw signed payloads before applying AR settlement with configured deposit-account routing."
  );
  assertFileIncludesAll(
    "src/lib/server/stripe-invoice-settlement.ts",
    ["checkout.session.completed", "payment_intent.succeeded", "metadata.invoiceId", "amount_received", "amount_total"],
    "Stripe invoice settlement helper extracts invoice ids and payment amounts from payment-link webhook events."
  );
  assertFileIncludesAll(
    "src/lib/server/invoice-email.ts",
    ["buildInvoiceEmail", "Pay this invoice online", "Accounting ERP"],
    "Invoice email helper renders accounting invoice collection emails with optional payment links."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/new/+page.server.ts",
    ["syncInvoiceToReceivables", "getInvoiceScoped", "issueInvoiceScoped", "postIssuedInvoiceToAccounting", "journalEntryId"],
    "New invoice issuance posts the AR invoice journal and creates an Accounts Receivable invoice snapshot from the canonical invoice record."
  );
  assertFileIncludesAll(
    "src/routes/app/receivables/+page.server.ts",
    ["recordCustomerPayment", "applyCustomerPayment", "recordPaymentScoped", "getInvoiceScoped", "syncInvoiceToReceivables", "journalEntryId"],
    "Receivables payment actions apply AR settlement, update the invoice module lifecycle, and refresh AR snapshots."
  );
  assertFileIncludesAll(
    "src/lib/server/accounts-receivable-accounting.ts",
    ["getAccountingSettings", "settingsConfigured", "defaultInvoiceAccounts", "defaultArAccount", "defaultDepositAccount", "defaultArAccountId", "defaultIncomeAccountId", "defaultDepositAccountId"],
    "Accounts Receivable posting consumes persisted accounting default AR/income/deposit accounts before legacy code fallback."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.server.ts",
    [
      "getAccountingSetupStatus",
      "defaultApAccount",
      "defaultApAccountId",
      "requireModule(\"accounting-core\"",
      "values.apAccountId || apDefault.accountId",
      "Choose Accounts Payable in Accounting settings"
    ],
    "Payables route loads and applies persisted accounting AP default settings server-side."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.server.ts",
    [
      "paymentApplications",
      "applicationBillId",
      "applicationAmount-",
      "paymentIdempotencyKey",
      "Select bills in one currency per payment.",
      "memo: values.memo || null"
    ],
    "Payables route supports AP payment workbench submissions with multiple bill applications, method, reference, and memo."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.server.ts",
    ["postToAccounting: false", "postBillToAccounting:", "accounts-payable.bill_posted"],
    "Payables route keeps bill approval separate from accounting posting."
  );
  assertFileIncludesAll(
    "src/lib/server/accounts-payable-accounting.ts",
    [
      "existingPostedEntry",
      "findPostedEntryBySourceRef",
      "accounts-payable:bill:${request.bill.id}",
      "accounts-payable:payment:${request.payment.id}"
    ],
    "AP accounting poster reuses posted source-ref journals on retry instead of double-posting."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.svelte",
    ["data.defaultApAccountId", "(bill.apAccountId ?? data.defaultApAccountId)", "form?.values?.apAccountId ?? data.defaultApAccountId"],
    "Payables AP account selectors default to persisted accounting settings when the bill has no AP account."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.svelte",
    ["Record payment", "applicationBillId", "applicationAmount-${bill.id}", "paidBillCount", "payment-workbench"],
    "Payables UI exposes a multi-bill AP payment workbench while preserving row-level payment actions."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.svelte",
    [
      "Approve",
      "?/postBillToAccounting",
      "bill.accountingStatus === \"posted\"",
      "Bill approved for posting",
      "Bill posted to the ledger"
    ],
    "Payables page presents approve, post, and pay as separate operator states."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.server.ts",
    [
      "defaultExpenseAccount",
      "defaultExpenseAccountId",
      "values.expenseAccountId || (await defaultExpenseAccount",
      "Choose an expense account or set a default on the vendor."
    ],
    "Payables route persists vendor default expense accounts and falls back to them for bill and recurring bill line accounts."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.svelte",
    ["vendor-default-expense-account", "name=\"defaultExpenseAccountId\"", "Vendor default"],
    "Payables UI exposes vendor default expense accounts and lets bill lines use the vendor default."
  );
  assertFileIncludesAll(
    "src/routes/app/reports/+page.server.ts",
    [
      "getAgingReport",
      "getReceivableAging",
      "listOpenReceivables",
      "generateCustomerStatement",
      "getGeneralLedger",
      "listAccounts",
      "requireModule(\"accounting-core\"",
      "requireModule(\"accounts-receivable\""
    ],
    "Accounting reports route composes AP aging, AR aging, open receivables, customer statements, and general ledger from module APIs."
  );
  assertFileIncludesAll(
    "src/routes/app/reports/+page.svelte",
    ["Aged receivables", "Aged payables", "Customer statement", "Statement invoices", "General ledger", "runningBalanceCents"],
    "Accounting reports page renders aging reports, customer statement output, and account-level general ledger output."
  );
  assertFileIncludes(
    "src/routes/app/receivables/+page.svelte",
    "/app/reports?asOf=",
    "Receivables rows link to the customer statement report."
  );
  assertFileIncludes(
    "src/lib/server/erp-nav.ts",
    "Reports\", href: \"/app/reports\"",
    "Sidebar exposes the accounting reports surface when accounting-core is enabled."
  );
  assertFileIncludesAll(
    "src/routes/app/settings/accounting/+page.server.ts",
    [
      "type ChartOfAccountsStandard",
      "CHART_STANDARDS",
      "updateAccountingSettings",
      "listAccounts",
      "saveDefaults",
      "\"gaap\", \"ifrs\"",
      "currencyCode",
      "form.get(\"baseCurrency\")",
      "form.get(\"defaultArAccountId\")",
      "form.get(\"defaultApAccountId\")",
      "form.get(\"defaultIncomeAccountId\")",
      "form.get(\"defaultDepositAccountId\")",
      "form.get(\"stripeDepositAccountId\")",
      "{ tenantId: org.id, standard, currency }"
    ],
    "Accounting settings seeds chart setup and persists default posting accounts through accounting-core."
  );
  assertFileIncludesAll(
    "src/routes/app/settings/accounting/+page.svelte",
    [
      "name=\"standard\"",
      "name=\"baseCurrency\"",
      "GAAP",
      "IFRS",
      "data.setup.baseCurrency",
      "Default posting accounts",
      "name=\"defaultArAccountId\"",
      "name=\"defaultApAccountId\"",
      "name=\"defaultIncomeAccountId\"",
      "name=\"defaultDepositAccountId\"",
      "name=\"stripeDepositAccountId\""
    ],
    "Accounting settings UI exposes chart standard, base-currency setup, and default posting account fields."
  );
  assert(
    accountingSettingsMigration.includes("CREATE TABLE IF NOT EXISTS accounting_settings") &&
      accountingSettingsMigration.includes("default_ar_account_id") &&
      accountingSettingsMigration.includes("default_ap_account_id") &&
      accountingSettingsMigration.includes("default_income_account_id"),
    "Accounting template includes the accounting settings/default-account persistence migration.",
    "policy:accounting-settings-migration"
  );
  assert(
    accountingDepositSettingsMigration.includes("default_deposit_account_id") &&
      accountingDepositSettingsMigration.includes("stripe_deposit_account_id"),
    "Accounting template includes the deposit-account settings upgrade migration.",
    "policy:accounting-deposit-settings-migration"
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/+page.server.ts",
    [
      "createAccount",
      "createFiscalPeriod",
      "listFiscalPeriods",
      "closeFiscalPeriod",
      "reopenFiscalPeriod",
      "lockFiscalPeriod",
      "createJournalEntry",
      "postJournalEntry",
      "voidJournalEntry",
      "getTrialBalance",
      "tenantId: ctx.org.id"
    ],
    "Ledger route exposes account, source-style fiscal period lifecycle, journal lifecycle, and trial balance adapters over accounting-core use cases scoped to the active org."
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/+page.svelte",
    ["?/closeFiscalPeriod", "?/reopenFiscalPeriod", "?/lockFiscalPeriod"],
    "Ledger fiscal-period table exposes source-style close, reopen, and lock row actions instead of arbitrary status setting."
  );
  assert(
    !readText("src/routes/app/ledger/+page.svelte").includes("period-status") &&
      !readText("src/routes/app/ledger/+page.server.ts").includes("status: text(form.get(\"status\""),
    "Ledger fiscal-period creation defaults to open and does not let the template bypass close/reopen/lock lifecycle actions.",
    "policy:accounting-ledger-fiscal-period-create-open-only"
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/+page.server.ts",
    ["fiscalPeriodType", "periodType: text(form.get(\"periodType\"", "periodType,"],
    "Ledger fiscal-period creation captures source-parity period type metadata while defaulting lifecycle status to open."
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/+page.svelte",
    ["period.periodType", "name=\"periodType\"", "Month", "Quarter", "Year", "Custom"],
    "Ledger fiscal-period table and create form expose period type metadata."
  );
  assert(
    accountingFiscalPeriodMetadataMigration.includes("ADD COLUMN period_type TEXT NOT NULL DEFAULT 'month'") &&
      accountingFiscalPeriodMetadataMigration.includes("ADD COLUMN closed_by_id TEXT"),
    "Accounting template includes an upgrade migration for fiscal-period period_type and closed_by_id metadata.",
    "policy:accounting-fiscal-period-metadata-migration"
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/+page.svelte",
    [
      "/app/ledger/accounts/${account.id}",
      "/app/ledger/accounts/${line.accountId}",
      "/app/ledger/fiscal-periods/${period.id}"
    ],
    "Ledger chart, trial-balance, and fiscal-period rows link to read-only detail routes."
  );
  assert(
    !readText("src/routes/app/ledger/+page.server.ts").includes("accountingCoreStore.listFiscalPeriods"),
    "Ledger index lists fiscal periods through the accounting-core listFiscalPeriods use case instead of direct store calls.",
    "policy:accounting-ledger-period-list-use-case"
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/accounts/[id]/+page.server.ts",
    [
      "getAccount",
      "listAccounts",
      "getTrialBalance",
      "requireModule(\"accounting-core\"",
      "requireOrgPermission",
      "\"org.read\"",
      "tenantId: activeOrgId",
      "accountId: params.id",
      "child.parentId === account.id"
    ],
    "Ledger account detail loads one tenant-scoped account through accounting-core and composes read-only child-account and trial-balance context."
  );
  assert(
    !ledgerAccountDetailServer.includes("export const actions") &&
      !ledgerAccountDetailServer.includes("AccountingCoreStore") &&
      !ledgerAccountDetailServer.includes("createD1AccountingCoreStore") &&
      !ledgerAccountDetailServer.includes("platform.env.DB") &&
      !ledgerAccountDetailServer.includes(".prepare(") &&
      !ledgerAccountDetailServer.includes("accountingCoreStore.getAccount") &&
      !ledgerAccountDetailServer.includes(".listFiscalPeriods") &&
      !ledgerAccountDetailServer.includes(".writeEvent") &&
      !ledgerAccountDetailServer.includes("createAccount") &&
      !ledgerAccountDetailServer.includes("createFiscalPeriod") &&
      !ledgerAccountDetailServer.includes("closeFiscalPeriod") &&
      !ledgerAccountDetailServer.includes("reopenFiscalPeriod") &&
      !ledgerAccountDetailServer.includes("lockFiscalPeriod") &&
      !ledgerAccountDetailServer.includes("updateFiscalPeriodStatus") &&
      !ledgerAccountDetailServer.includes("seedChartOfAccounts") &&
      !ledgerAccountDetailServer.includes("seedMonthlyFiscalPeriods") &&
      !ledgerAccountDetailServer.includes("createJournalEntry") &&
      !ledgerAccountDetailServer.includes("updateJournalEntry") &&
      !ledgerAccountDetailServer.includes("postJournalEntry") &&
      !ledgerAccountDetailServer.includes("voidJournalEntry") &&
      !ledgerAccountDetailServer.includes("recordEvent") &&
      !ledgerAccountDetailServer.includes("bankReconciliationService") &&
      !ledgerAccountDetailServer.includes("recordCustomerPayment") &&
      !ledgerAccountDetailServer.includes("syncInvoiceToReceivables") &&
      !ledgerAccountDetailServer.includes("enqueueJob") &&
      !ledgerAccountDetailServer.includes("sendEmail") &&
      !/(?:insert|update|upsert|delete)[A-Z]/.test(ledgerAccountDetailServer),
    "Ledger account detail route remains read-only; setup, fiscal-period, journal, event, and direct store writes stay off the detail route.",
    "policy:accounting-ledger-account-detail-read-only"
  );
  assert(
    !ledgerAccountDetailPage.includes("<form") &&
      !ledgerAccountDetailPage.includes("method=\"POST\"") &&
      !ledgerAccountDetailPage.includes("use:enhance") &&
      !ledgerAccountDetailPage.includes("?/"),
    "Ledger account detail page does not render write-capable forms or SvelteKit action targets.",
    "policy:accounting-ledger-account-detail-ui-read-only"
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/accounts/[id]/+page.svelte",
    ["Account profile", "Posting policy", "Child accounts", "Open ledger actions"],
    "Ledger account detail page exposes read-only account metadata, posting policy, child accounts, and ledger handoff."
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/fiscal-periods/[id]/+page.server.ts",
    [
      "getFiscalPeriod",
      "listFiscalPeriods",
      "getTrialBalance",
      "requireModule(\"accounting-core\"",
      "requireOrgPermission",
      "\"org.read\"",
      "tenantId: activeOrgId",
      "periodId: params.id"
    ],
    "Ledger fiscal-period detail loads one tenant-scoped period through accounting-core and composes read-only period context."
  );
  assert(
    !ledgerFiscalPeriodDetailServer.includes("export const actions") &&
      !ledgerFiscalPeriodDetailServer.includes("AccountingCoreStore") &&
      !ledgerFiscalPeriodDetailServer.includes("createD1AccountingCoreStore") &&
      !ledgerFiscalPeriodDetailServer.includes("platform.env.DB") &&
      !ledgerFiscalPeriodDetailServer.includes(".prepare(") &&
      !ledgerFiscalPeriodDetailServer.includes("accountingCoreStore.getFiscalPeriod") &&
      !ledgerFiscalPeriodDetailServer.includes("accountingCoreStore.listFiscalPeriods") &&
      !ledgerFiscalPeriodDetailServer.includes(".writeEvent") &&
      !ledgerFiscalPeriodDetailServer.includes("createAccount") &&
      !ledgerFiscalPeriodDetailServer.includes("createFiscalPeriod") &&
      !ledgerFiscalPeriodDetailServer.includes("closeFiscalPeriod") &&
      !ledgerFiscalPeriodDetailServer.includes("reopenFiscalPeriod") &&
      !ledgerFiscalPeriodDetailServer.includes("lockFiscalPeriod") &&
      !ledgerFiscalPeriodDetailServer.includes("updateFiscalPeriodStatus") &&
      !ledgerFiscalPeriodDetailServer.includes("seedChartOfAccounts") &&
      !ledgerFiscalPeriodDetailServer.includes("seedMonthlyFiscalPeriods") &&
      !ledgerFiscalPeriodDetailServer.includes("createJournalEntry") &&
      !ledgerFiscalPeriodDetailServer.includes("updateJournalEntry") &&
      !ledgerFiscalPeriodDetailServer.includes("postJournalEntry") &&
      !ledgerFiscalPeriodDetailServer.includes("voidJournalEntry") &&
      !ledgerFiscalPeriodDetailServer.includes("recordEvent") &&
      !ledgerFiscalPeriodDetailServer.includes("bankReconciliationService") &&
      !ledgerFiscalPeriodDetailServer.includes("recordCustomerPayment") &&
      !ledgerFiscalPeriodDetailServer.includes("syncInvoiceToReceivables") &&
      !ledgerFiscalPeriodDetailServer.includes("enqueueJob") &&
      !ledgerFiscalPeriodDetailServer.includes("sendEmail") &&
      !/(?:insert|update|upsert|delete)[A-Z]/.test(ledgerFiscalPeriodDetailServer),
    "Ledger fiscal-period detail route remains read-only; setup, status, journal, event, and direct store writes stay off the detail route.",
    "policy:accounting-ledger-fiscal-period-detail-read-only"
  );
  assert(
    !ledgerFiscalPeriodDetailPage.includes("<form") &&
      !ledgerFiscalPeriodDetailPage.includes("method=\"POST\"") &&
      !ledgerFiscalPeriodDetailPage.includes("use:enhance") &&
      !ledgerFiscalPeriodDetailPage.includes("?/"),
    "Ledger fiscal-period detail page does not render write-capable forms or SvelteKit action targets.",
    "policy:accounting-ledger-fiscal-period-detail-ui-read-only"
  );
  assertFileIncludesAll(
    "src/routes/app/ledger/fiscal-periods/[id]/+page.svelte",
    ["Period profile", "Trial balance activity", "Fiscal year", "Close policy", "Open ledger actions"],
    "Ledger fiscal-period detail page exposes read-only period metadata, trial-balance activity, fiscal-year context, and ledger handoff."
  );
  assertFileIncludesAll(
    "src/routes/app/banking/+page.server.ts",
    ["createBankAccount", "importStatementCsv", "suggestMatches", "createMatch", "matchTransaction", "startReconciliation", "listReconciliations", "completeReconciliation", "recordEvent"],
    "Banking route exposes operator actions and persisted reconciliation sessions through bank-reconciliation service methods."
  );
  assertFileIncludes(
    "src/routes/app/banking/+page.svelte",
    "/app/banking/imports/${statementImport.id}",
    "Banking import history links to the read-only statement import detail route."
  );
  assertFileIncludes(
    "src/routes/app/banking/+page.svelte",
    "/app/banking/reconciliations/${session.id}",
    "Banking reconciliation history links to the read-only reconciliation detail route."
  );
  assertFileIncludesAll(
    "src/routes/app/banking/imports/[id]/+page.server.ts",
    [
      "requireModule(\"bank-reconciliation\"",
      "requireOrgPermission",
      "\"org.read\"",
      "listBankAccounts(ctx)",
      "service.listStatementImports(ctx, account.id)",
      "listStatementTransactions(ctx, statementImport.bankAccountId)",
      "transaction.statementImportId === statementImport.id",
      "transaction.bankAccountId === statementImport.bankAccountId",
      "transaction.tenantId === activeOrgId"
    ],
    "Banking import detail proves the bank account scope before loading transactions and then filters by statement import, account, and tenant."
  );
  assert(
    !bankingImportDetailServer.includes("export const actions") &&
      !bankingImportDetailServer.includes("BankReconciliationStore") &&
      !bankingImportDetailServer.includes("createD1BankReconciliationStore") &&
      !bankingImportDetailServer.includes("platform.env.DB") &&
      !bankingImportDetailServer.includes(".prepare(") &&
      !bankingImportDetailServer.includes("createBankAccount") &&
      !bankingImportDetailServer.includes("importStatementCsv") &&
      !bankingImportDetailServer.includes("importStatementTransactions") &&
      !bankingImportDetailServer.includes("suggestMatches") &&
      !bankingImportDetailServer.includes("createMatch") &&
      !bankingImportDetailServer.includes("matchTransaction") &&
      !bankingImportDetailServer.includes("startReconciliation") &&
      !bankingImportDetailServer.includes("completeReconciliation") &&
      !bankingImportDetailServer.includes("recordEvent") &&
      !bankingImportDetailServer.includes("enqueueJob") &&
      !bankingImportDetailServer.includes("sendEmail") &&
      !bankingImportDetailServer.includes("postJournalEntry") &&
      !bankingImportDetailServer.includes("syncInvoiceToReceivables") &&
      !bankingImportDetailServer.includes("insert") &&
      !bankingImportDetailServer.includes("update") &&
      !bankingImportDetailServer.includes("upsert") &&
      !bankingImportDetailServer.includes("delete"),
    "Banking import detail route remains read-only; import, match, reconciliation, event, job, email, journal, sync, and direct store writes stay off the detail route.",
    "policy:accounting-banking-import-detail-read-only"
  );
  assert(
    !bankingImportDetailPage.includes("<form") &&
      !bankingImportDetailPage.includes("method=\"POST\"") &&
      !bankingImportDetailPage.includes("use:enhance") &&
      !bankingImportDetailPage.includes("?/"),
    "Banking import detail page does not render write-capable forms or SvelteKit action targets.",
    "policy:accounting-banking-import-detail-ui-read-only"
  );
  assertFileIncludesAll(
    "src/routes/app/banking/imports/[id]/+page.svelte",
    ["Imported transactions", "CSV mapping", "Open banking actions", "Reconciliation context"],
    "Banking import detail page exposes transaction review, mapping, and related reconciliation context."
  );
  assertFileIncludesAll(
    "src/routes/app/banking/reconciliations/[id]/+page.server.ts",
    [
      "requireModule(\"bank-reconciliation\"",
      "requireOrgPermission",
      "\"org.read\"",
      "listBankAccounts(ctx)",
      "service.listReconciliations(ctx, account.id)",
      "listStatementTransactions(ctx, reconciliation.bankAccountId)",
      "listStatementImports(ctx, reconciliation.bankAccountId)",
      "transaction.bankAccountId !== reconciliation.bankAccountId",
      "transaction.tenantId !== activeOrgId",
      "transaction.reconciliationId === reconciliation.id",
      "transaction.reconciled === true",
      "reconciliation.status !== \"in_progress\"",
      "transaction.transactionDate <= reconciliation.statementDate"
    ],
    "Banking reconciliation detail proves account scope, uses read-only bank-reconciliation lists, and filters transactions by tenant/account plus session status."
  );
  assert(
    !bankingReconciliationDetailServer.includes("export const actions") &&
      !bankingReconciliationDetailServer.includes("BankReconciliationStore") &&
      !bankingReconciliationDetailServer.includes("createD1BankReconciliationStore") &&
      !bankingReconciliationDetailServer.includes("platform.env.DB") &&
      !bankingReconciliationDetailServer.includes(".prepare(") &&
      !bankingReconciliationDetailServer.includes("createBankAccount") &&
      !bankingReconciliationDetailServer.includes("importStatementCsv") &&
      !bankingReconciliationDetailServer.includes("importStatementTransactions") &&
      !bankingReconciliationDetailServer.includes("suggestMatches") &&
      !bankingReconciliationDetailServer.includes("createMatch") &&
      !bankingReconciliationDetailServer.includes("matchTransaction") &&
      !bankingReconciliationDetailServer.includes("startReconciliation") &&
      !bankingReconciliationDetailServer.includes("completeReconciliation") &&
      !bankingReconciliationDetailServer.includes("recordEvent") &&
      !bankingReconciliationDetailServer.includes("enqueueJob") &&
      !bankingReconciliationDetailServer.includes("sendEmail") &&
      !bankingReconciliationDetailServer.includes("postJournalEntry") &&
      !bankingReconciliationDetailServer.includes("syncInvoiceToReceivables") &&
      !/(?:insert|update|upsert|delete)[A-Z]/.test(bankingReconciliationDetailServer),
    "Banking reconciliation detail route remains read-only; import, match, reconciliation, event, job, email, journal, sync, and direct store writes stay off the detail route.",
    "policy:accounting-banking-reconciliation-detail-read-only"
  );
  assert(
    !bankingReconciliationDetailPage.includes("<form") &&
      !bankingReconciliationDetailPage.includes("method=\"POST\"") &&
      !bankingReconciliationDetailPage.includes("use:enhance") &&
      !bankingReconciliationDetailPage.includes("?/"),
    "Banking reconciliation detail page does not render write-capable forms or SvelteKit action targets.",
    "policy:accounting-banking-reconciliation-detail-ui-read-only"
  );
  assertFileIncludesAll(
    "src/routes/app/banking/reconciliations/[id]/+page.svelte",
    ["Statement transactions", "Related imports", "Balance proof", "Open banking actions"],
    "Banking reconciliation detail page exposes transaction review, import context, and balance proof."
  );
  assertFileIncludesAll(
    "microservices.lock.json",
    ["accounts-payable.pay", "beforeBillMarkPayable", "accounts-payable.bill_marked_payable", "accounts-payable.recurring_bill_generated"],
    "Accounting template lock keeps accounts-payable permissions, hooks, and events aligned with the module contract."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.server.ts",
    ["createRecurringBillTemplate", "listRecurringBillTemplates", "updateRecurringBillTemplateStatus", "generateDueRecurringBills", "postToAccounting: false"],
    "Payables route exposes recurring bill schedules and due generation through accounts-payable use cases while keeping final posting operator-gated."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.svelte",
    ["Recurring bills", "Create recurring bill", "?/createRecurringBillTemplate", "?/generateDueRecurringBills", "?/updateRecurringBillStatus", "/app/payables/recurring/${template.id}", "/app/payables/${bill.id}"],
    "Payables page exposes AP bill detail links and recurring bill route proof for schedule creation, status changes, and due generation."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.svelte",
    [
      "Payables vendors",
      "1099 readiness",
      "data.report1099",
      "/app/payables/vendors/${vendor.id}",
      "/app/payables/vendors/${bill.vendorId}",
      "/app/payables/vendors/${template.vendorId}"
    ],
    "Payables page exposes AP vendor directory, 1099 readiness, and links bill/recurring rows to vendor detail."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/+page.server.ts",
    ["get1099VendorReport", "report1099", "is1099Vendor", "defaultPaymentTermsDays", "taxId", "phone"],
    "Payables route loads formal 1099 readiness and captures complete vendor master fields on create."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/vendors/[id]/+page.server.ts",
    [
      "getVendor",
      "updateVendor",
      "updateVendorStatus",
      "listBills",
      "listBillPayments",
      "listRecurringBillTemplates",
      "getAgingReport",
      "taxSummary",
      "accounts-payable.vendor_updated",
      "accounts-payable.vendor_status_updated",
      "requireModule(\"accounts-payable\"",
      "requireOrgPermission",
      "\"org.read\"",
      "\"member.manage\""
    ],
    "Vendor detail route composes tenant-scoped AP reads and approval-gated vendor master/status mutations."
  );
  assert(
    !vendorDetailServer.includes("recordBillPayment(") &&
      !vendorDetailServer.includes("markBillPayable(") &&
      !vendorDetailServer.includes("createBill("),
    "Vendor detail route does not perform bill posting or payment side effects.",
    "policy:accounting-ap-vendor-detail-no-money-side-effects"
  );
  assertFileIncludesAll(
    "src/routes/app/payables/vendors/[id]/+page.svelte",
    [
      "AP vendor",
      "Vendor profile",
      "1099 readiness",
      "Payment history",
      "/app/payables/payments/${payment.id}",
      "Recurring bills",
      "Vendor master",
      "?/updateVendor",
      "?/updateVendorStatus",
      "Deactivate vendor",
      "Reactivate vendor"
    ],
    "Vendor detail page exposes AP profile, 1099 readiness, payment history, recurring context, and vendor master controls."
  );
  assertFileIncludesAll(
    "src/lib/server/accounts-payable-accounting.ts",
    ["voidJournalEntry", "void:${originalEntryId}", "findPostedEntryBySourceRef", "reversalPeriodId", "reversalDate"],
    "AP accounting poster voids payment journals through accounting-core reversal semantics and checks reversal source refs for retry safety."
  );
  assertFileIncludesAll(
    "src/routes/app/payables/payments/[id]/+page.server.ts",
    [
      "getBillPayment",
      "voidBillPayment",
      "createAccountsPayableAccountingPoster",
      "getVendor",
      "listBills",
      "listAccounts",
      "requireModule(\"accounts-payable\"",
      "requireModule(\"accounting-core\"",
      "requireOrgPermission",
      "\"org.read\"",
      "\"member.manage\"",
      "accounts-payable.bill_payment_voided"
    ],
    "Payment detail route loads one tenant-scoped AP payment and exposes guarded accounting-backed payment void."
  );
  assert(
    !paymentDetailServer.includes("recordBillPayment(") &&
      !paymentDetailServer.includes("updateVendor(") &&
      !paymentDetailServer.includes("postBillToAccounting(") &&
      !paymentDetailServer.includes("markBillPayable("),
    "Payment detail route only exposes guarded payment void; bill posting and payment creation stay on the Payables operator page.",
    "policy:accounting-ap-payment-detail-void-only"
  );
  assertFileIncludesAll(
    "src/routes/app/payables/payments/[id]/+page.svelte",
    ["AP payment", "Payment details", "Applications", "Lifecycle", "Void payment", "?/voidPayment", "/app/payables/${application.billId}"],
    "Payment detail page exposes payment, application, lifecycle, and guarded void controls."
  );
  assert(
    !paymentDetailPage.includes("?/recordPayment") &&
      !paymentDetailPage.includes("?/postBillToAccounting") &&
      !paymentDetailPage.includes("use:enhance"),
    "Payment detail page only exposes a guarded payment void form; creation/posting actions remain on the Payables operator page.",
    "policy:accounting-ap-payment-detail-void-only-ui"
  );
  assertFileIncludesAll(
    "src/routes/app/payables/[id]/+page.server.ts",
    [
      "getBill",
      "listBillPayments",
      "voidBill",
      "paymentHistory",
      "listVendors",
      "listAccounts",
      "requireModule(\"accounts-payable\"",
      "requireOrgPermission",
      "\"org.read\"",
      "\"member.manage\"",
      "accounts-payable.bill_voided"
    ],
    "Bill detail route loads one tenant-scoped bill, payment history, and guarded unpaid bill void action through accounts-payable."
  );
  assert(
    !billDetailServer.includes("markBillPayable(") &&
      !billDetailServer.includes("recordBillPayment(") &&
      !billDetailServer.includes("postBillToAccounting("),
    "Bill detail route only exposes unpaid unposted void; posting and payment side effects remain on the Payables operator page.",
    "policy:accounting-ap-bill-detail-no-post-pay"
  );
  assertFileIncludesAll(
    "src/routes/app/payables/[id]/+page.svelte",
    [
      "Vendor bill",
      "Bill details",
      "Line items",
      "Payment history",
      "paymentHistory",
      "/app/payables/payments/${payment.id}",
      "Totals",
      "Open payables actions",
      "Void bill",
      "?/voidBill",
      "Only unpaid, unposted bills"
    ],
    "Bill detail page exposes vendor, line-item, payment history, totals, lifecycle context, and guarded unpaid void."
  );
  assert(
    !billDetailPage.includes("?/markPayable") &&
      !billDetailPage.includes("?/recordPayment") &&
      !billDetailPage.includes("?/postBillToAccounting") &&
      !billDetailPage.includes("use:enhance"),
    "Bill detail page only exposes a guarded void form; post/payment actions remain on the Payables operator page.",
    "policy:accounting-ap-bill-detail-void-only"
  );
  assertFileIncludesAll(
    "src/routes/app/payables/recurring/[id]/+page.server.ts",
    ["getRecurringBillTemplate", "requireModule(\"accounts-payable\"", "requireOrgPermission", "\"org.read\""],
    "Recurring bill detail route loads one tenant-scoped schedule through the accounts-payable module under route-level read permission."
  );
  assert(
    !recurringBillDetailServer.includes("export const actions") &&
      !recurringBillDetailServer.includes("generateDueRecurringBills") &&
      !recurringBillDetailServer.includes("updateRecurringBillTemplateStatus"),
    "Recurring bill detail route remains read-only; generation and status changes stay on the Payables route.",
    "policy:accounting-recurring-bill-detail-read-only"
  );
  assertFileIncludesAll(
    "src/routes/app/payables/recurring/[id]/+page.svelte",
    ["Open payables actions", "Line items", "Next bill", "Generated", "Auto mark payable"],
    "Recurring bill detail page exposes read-only schedule, totals, and line item review."
  );
  assertFileIncludesAll(
    "microservices.lock.json",
    ["beforeMatchCreate", "beforeReconciliationStart", "afterReconciliationChanged"],
    "Accounting template lock keeps bank-reconciliation hook names aligned with the module contract."
  );
  assertFileIncludesAll(
    "src/hooks.server.ts",
    ["@microservices-sh/gateway/adapters/kv-rate-limit", "RATE_LIMIT_KV"],
    "Request hook uses gateway rate-limit stores with the shared RATE_LIMIT_KV binding."
  );
  assertFileIncludes(
    "migrations/0010_gateway.sql",
    "CREATE TABLE IF NOT EXISTS api_keys",
    "Template includes gateway API-key storage for the declared gateway module."
  );
  assertFileIncludesAll(
    "scripts/smoke-http.mjs",
    ["route:/", "route:/app:auth-redirect"],
    "HTTP smoke script verifies the public pages and the /app auth gate."
  );
  assertFileIncludesAll(
    "src/routes/api/desktop/import/+server.ts",
    [
      "DESKTOP_IMPORT_TOKEN",
      "desktop.draft.import",
      "enqueueJob",
      "recordEvent",
      "canonicalStore: \"remote-d1\""
    ],
    "Desktop import API authenticates approved desktop drafts, queues a module job, and records an audit event."
  );
  assertFileIncludesAll(
    "wrangler.jsonc",
    ["DB", "MEDIA_BUCKET", "RATE_LIMIT_KV", "JOB_QUEUE", "\"triggers\"", "\"crons\"", "DESKTOP_IMPORT_ALLOWED_ORIGIN"],
    "Cloudflare deployment config declares canonical D1 plus R2/KV/Queue bindings used by the ERP Worker."
  );
  assert(
    !exists("src/lib/server/modules/org-team-rbac/index.ts"),
    "Template does not own org-team-rbac internals.",
    "policy:no-local-rbac-module"
  );
  assert(
    !exists("src/lib/server/modules/customer/index.ts"),
    "Template does not own customer module internals.",
    "policy:no-local-customer-module"
  );
}
