export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists }) {
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
    ["postIssuedInvoiceToAccounting", "createAccountsReceivableAccountingPoster", "\"1200\"", "\"4100\"", "\"1120\"", "postAccountsReceivablePayment"],
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
    "src/routes/api/payments/stripe-webhook/+server.ts",
    ["request.text()", "verifyWebhookSignature", "parseStripeInvoiceSettlementEvent", "recordCustomerPayment", "applyCustomerPayment", "recordPaymentScoped", "syncInvoiceToReceivables", "stripe-signature"],
    "Stripe webhook route verifies raw signed payloads before applying AR settlement, recording invoice payments, and refreshing receivables snapshots."
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
    "src/routes/app/reports/+page.server.ts",
    ["getAgingReport", "getReceivableAging", "listOpenReceivables", "generateCustomerStatement", "requireModule(\"accounts-receivable\""],
    "Accounting reports route composes AP aging, AR aging, open receivables, and customer statements from module APIs."
  );
  assertFileIncludesAll(
    "src/routes/app/reports/+page.svelte",
    ["Aged receivables", "Aged payables", "Customer statement", "Statement invoices"],
    "Accounting reports page renders aging reports and customer statement output."
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
    "src/routes/app/ledger/+page.server.ts",
    [
      "createAccount",
      "createFiscalPeriod",
      "updateFiscalPeriodStatus",
      "createJournalEntry",
      "postJournalEntry",
      "voidJournalEntry",
      "getTrialBalance",
      "tenantId: ctx.org.id"
    ],
    "Ledger route exposes account, fiscal period, journal lifecycle, and trial balance adapters over accounting-core use cases scoped to the active org."
  );
  assertFileIncludesAll(
    "src/routes/app/banking/+page.server.ts",
    ["createBankAccount", "importStatementCsv", "suggestMatches", "createMatch", "matchTransaction", "startReconciliation", "listReconciliations", "completeReconciliation", "recordEvent"],
    "Banking route exposes operator actions and persisted reconciliation sessions through bank-reconciliation service methods."
  );
  assertFileIncludesAll(
    "microservices.lock.json",
    ["accounts-payable.pay", "beforeBillMarkPayable", "accounts-payable.bill_marked_payable", "accounts-payable.recurring_bill_generated"],
    "Accounting template lock keeps accounts-payable permissions, hooks, and events aligned with the module contract."
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
