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
    "migrations/0004_invoice.sql",
    ["CREATE TABLE IF NOT EXISTS invoice_recurring_templates", "idx_invoices_recurring_occurrence"],
    "Template keeps recurring invoice tables and occurrence dedupe index aligned with the invoice module."
  );
  assertFileIncludesAll(
    "migrations/0027_commerce_sync.sql",
    ["CREATE TABLE IF NOT EXISTS commerce_sync_envelopes", "idx_commerce_sync_envelopes_external"],
    "Template keeps normalized commerce envelope storage aligned with the commerce-sync module."
  );
  assertFileIncludesAll(
    "src/routes/app/commerce-sync/+page.server.ts",
    [
      "createCommerceConnection",
      "startSyncRun",
      "completeSyncRun",
      "runWooCommerceSync",
      "syncWooCommercePage",
      "WooCommerceClient",
      "parseWooCommerceCredentials",
      "recordWebhookReceipt",
      "verifyWooCommerceWebhookSignature",
      "WOOCOMMERCE_CREDENTIALS_JSON",
      "WOOCOMMERCE_WEBHOOK_SECRET",
      "recordEvent"
    ],
    "Commerce sync route exposes operator actions through commerce-sync use cases, can run WooCommerce page syncs, and records audit events."
  );
  assertFileIncludesAll(
    "package.json",
    ["generate:mcp", "mcp", "@microservices-sh/sdk-internal", "@modelcontextprotocol/sdk", "tsx"],
    "Commerce template can generate and run a governed MCP server for installed module tools."
  );
  assertFileIncludesAll(
    "scripts/generate-mcp.mjs",
    ["loadConnections", "join(root, \"modules\", id, \"module.json\")", "generateToolManifest(m)", "templateId"],
    "Commerce MCP generator reads authoritative module rpc contracts in workspace and vendored-template layouts."
  );
  assertFileIncludesAll(
    "microservices.lock.json",
    [
      "\"method\": \"createProduct\"",
      "\"method\": \"stockIn\"",
      "\"method\": \"createDraftOrder\"",
      "\"method\": \"createShipment\""
    ],
    "Commerce lock snapshot carries RPC methods for catalog, inventory, sales-order, and shipment agent tools."
  );
  assertFileIncludesAll(
    "src/lib/server/mcp-wiring.ts",
    [
      "product-catalog_createProduct",
      "inventory_stockIn",
      "sales-order_createDraftOrder",
      "shipment_createShipment",
      "support-ticket_createTicket",
      "file-media_createUploadTicket",
      "authorize",
      "actorContext"
    ],
    "Commerce MCP wiring binds generated governed tools to real module use cases and shared governance hooks."
  );
  assertFileIncludesAll(
    "src/routes/api/commerce-sync/woocommerce/[tenantId]/[connectionId]/+server.ts",
    [
      "request.text()",
      "verifyWooCommerceWebhookSignature",
      "recordWebhookReceipt",
      "normalizeCommercePayload",
      "importWooCommerceOrderEnvelope",
      "WOOCOMMERCE_WEBHOOK_SECRET"
    ],
    "WooCommerce webhook API verifies the raw payload before parsing, records receipt idempotency, and imports orders through the template bridge."
  );
  assertFileIncludesAll(
    "src/lib/server/commerce-order-import.ts",
    [
      "createDraftOrder",
      "upsertCustomer",
      "findProductBySku",
      "recordProviderMapping",
      "woocommerce:"
    ],
    "Commerce order import helper maps normalized WooCommerce orders into customer, product, sales-order, and provider-mapping modules."
  );
  assertFileIncludesAll(
    "src/routes/app/sales-orders/+page.server.ts",
    ["createSalesOrderInventoryReservationPort", "releaseSalesOrderReservations", "confirmOrder", "releasedReservations"],
    "Sales order confirmation reserves stock through the inventory bridge before moving orders to confirmed, then releases reservations on terminal handoff."
  );
  assertFileIncludesAll(
    "src/routes/app/shipments/+page.server.ts",
    ["deductStock", "consumeReserved", "completeShipment", "shipmentDocuments", "customerSnapshot", "expandProductComponents", "pickListPrintItems"],
    "Shipment completion consumes reserved inventory for sales-order-backed fulfillment and exposes alias-aware, combo-expanded shipping context for packing slips."
  );
  assertFileIncludesAll(
    "src/routes/app/shipments/+page.svelte",
    ["printShipmentPackingSlip", "printShipmentPickList", "pickItems", "Packing slip", "Pick list"],
    "Shipments page exposes StackSuite-style packing slip and pick-list print actions."
  );
  assertFileIncludesAll(
    "src/lib/packing-slip.ts",
    ["generateShipmentPackingSlipHtml", "generateShipmentPickListHtml", "Packed By", "Picked By"],
    "Packing slip helper renders standalone print documents with item checkboxes and fulfillment signatures."
  );
  assertFileIncludesAll(
    "src/lib/document-export.ts",
    ["generateInvoicePrintHtml", "generateSalesOrderPrintHtml", "generateCsv", "safeDocumentFilename", "printDocumentHtml", "downloadCsv"],
    "Document export helper renders invoice and sales-order print documents and CSV downloads using escaped standalone artifacts."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/[id]/+page.server.ts",
    [
      "lineItems: lineItems.map",
      "subtotalCents",
      "issuedAt",
      "paymentLinkUrl",
      "createInvoicePaymentLinkScoped",
      "sendEmail",
      "buildInvoiceEmail",
      "invoice.sent"
    ],
    "Invoice detail load exposes scoped raw document data and operator actions for payment links and invoice email sends."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/[id]/+page.svelte",
    ["generateInvoicePrintHtml", "generateInvoiceLineItemsCsv", "printInvoice", "exportInvoiceLines", "Payment link", "Send invoice", "Print", "CSV"],
    "Invoice detail page exposes StackSuite-style print, CSV, payment-link, and send-invoice actions."
  );
  assertFileIncludesAll(
    "src/hooks.server.ts",
    ["createStripeInvoicePaymentLinkProvider", "createMemoryInvoicePaymentLinkProvider", "getEmailDeps", "invoicePaymentLinkProvider", "emailProvider"],
    "Request locals wire Stripe/memory invoice payment links and transactional email providers for invoice-send workflows."
  );
  assertFileIncludesAll(
    "src/routes/api/payments/stripe-webhook/+server.ts",
    ["request.text()", "verifyWebhookSignature", "parseStripeInvoiceSettlementEvent", "recordPaymentScoped", "recordEvent", "stripe-signature"],
    "Stripe webhook route verifies raw signed payloads before recording invoice payments idempotently."
  );
  assertFileIncludesAll(
    "src/lib/server/stripe-invoice-settlement.ts",
    ["checkout.session.completed", "payment_intent.succeeded", "metadata.invoiceId", "amount_received", "amount_total"],
    "Stripe invoice settlement helper extracts invoice ids and payment amounts from payment-link webhook events."
  );
  assertFileIncludesAll(
    "src/lib/server/invoice-email.ts",
    ["buildInvoiceEmail", "Pay this invoice online", "formatDocumentMoney", "escapeHtml"],
    "Invoice email helper renders escaped customer-facing payment-link messages."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/+page.svelte",
    ["generateInvoiceLedgerCsv", "exportInvoices", "Export CSV"],
    "Invoice ledger can export the current scoped invoice list as CSV."
  );
  assertFileIncludesAll(
    "src/routes/app/sales-orders/+page.svelte",
    ["generateSalesOrderPrintHtml", "generateSalesOrderLedgerCsv", "generateSalesOrderLineItemsCsv", "printSalesOrder", "exportSalesOrder", "Export CSV", "?/cancel"],
    "Sales order ledger exposes row-level print, CSV, and cancellation actions."
  );
  assertFileIncludesAll(
    "src/lib/server/sales-order-inventory.ts",
    ["createSalesOrderInventoryReservationPort", "releaseSalesOrderReservations", "reserveStock", "releaseReservation", "findMovementBySourceRef"],
    "Sales order host bridge reserves stock on confirmation and releases tracked reservations after invoice or cancellation."
  );
  assertFileIncludesAll(
    "src/routes/app/sales-orders/+page.server.ts",
    ["cancelOrder", "createSalesOrderInventoryReservationPort", "releaseSalesOrderReservations", "releasedReservations", "sales-order.order_cancelled"],
    "Sales order route wires confirm, invoice, and cancel lifecycle actions through module ports plus inventory release side effects."
  );
  assertFileIncludesAll(
    "src/lib/server/demo.ts",
    ["demoInventoryReservationPort", "reserveStock", "inventoryReservationPort"],
    "Commerce demo seeding confirms orders through the same inventory reservation bridge as the route adapter."
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
    ["runDueJobs", "createRecurringInvoiceJobHandlers", "jobRunStore"],
    "Jobs route can run due jobs through the registered recurring invoice handler."
  );
  assertFileIncludesAll(
    "src/lib/server/scheduled.ts",
    ["dueScheduledJobs", "runDueJobs", "createRecurringInvoiceJobHandlers", "createCfQueueProducer", "jobs-workflows.cron_run"],
    "Scheduled runtime catches up recurring schedules and executes due jobs through the same module handlers as the operator UI."
  );
  assertFileIncludesAll(
    "src/hooks.server.ts",
    ["export async function scheduled", "runCommerceScheduled", "ctx.waitUntil"],
    "Cloudflare native cron events are exported from the SvelteKit Worker hook."
  );
  assertFileIncludesAll(
    "src/routes/api/cron/run/+server.ts",
    ["CRON_TOKEN", "authorization", "runCommerceScheduled", "enqueued", "ran"],
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
