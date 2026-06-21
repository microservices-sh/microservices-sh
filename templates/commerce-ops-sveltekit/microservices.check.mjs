export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists, readText }) {
  const hooksServer = readText("src/hooks.server.ts");
  const productCatalogMigration = readText("migrations/0019_product_catalog.sql");
  const salesOrderMigration = readText("migrations/0021_sales_order.sql");
  const shipmentMigration = readText("migrations/0022_shipment.sql");
  const commerceSyncMigration = readText("migrations/0027_commerce_sync.sql");
  const mcpGenerator = readText("scripts/generate-mcp.mjs");
  const mcpWiring = readText("src/lib/server/mcp-wiring.ts");
  const agentCenter = readText("src/routes/app/agent/+page.server.ts");
  const commerceSyncLogsServer = readText("src/routes/app/commerce-sync/logs/+page.server.ts");
  const commerceSyncLogsPage = readText("src/routes/app/commerce-sync/logs/+page.svelte");
  const salesOrderDetailServer = readText("src/routes/app/sales-orders/[id]/+page.server.ts");

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
  assert(
    !commerceSyncMigration.includes("CREATE TABLE IF NOT EXISTS domain_events"),
    "Commerce sync migration does not redeclare the core-owned domain_events table.",
    "policy:commerce-sync-no-domain-events-redeclare"
  );
  assert(
    !productCatalogMigration.includes("CREATE TABLE IF NOT EXISTS domain_events") &&
      !salesOrderMigration.includes("CREATE TABLE IF NOT EXISTS domain_events") &&
      !shipmentMigration.includes("CREATE TABLE IF NOT EXISTS domain_events"),
    "Commerce product, sales-order, and shipment migrations do not redeclare the core-owned domain_events table.",
    "policy:commerce-domain-events-core-owned"
  );
  for (const moduleId of ["product-catalog", "sales-order", "shipment", "commerce-sync"]) {
    const moduleMigration = `modules/${moduleId}/migrations/0001_initial.sql`;
    if (!exists(moduleMigration)) continue;
    const source = readText(moduleMigration);
    assert(
      source.includes("event_name TEXT NOT NULL") &&
        source.includes("entity_type TEXT NOT NULL") &&
        source.includes("entity_id TEXT NOT NULL") &&
        !source.includes("event_type TEXT NOT NULL") &&
        !source.includes("aggregate_id TEXT"),
      `Packaged ${moduleId} module migration uses the shared domain_events schema.`,
      `policy:packaged-${moduleId}-domain-events-schema`
    );
  }
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
    "src/routes/app/commerce-sync/+page.svelte",
    ["/app/commerce-sync/logs", "Sync logs"],
    "Commerce sync page links to the read-only logs route."
  );
  assertFileIncludesAll(
    "src/routes/app/commerce-sync/logs/+page.server.ts",
    ["requireOrgPermission", "listSyncRuns(ctx)", "listWebhookReceipts(ctx)", "listProviderMappings(ctx)", "connectionsById", "slice(0, LIMIT)"],
    "Commerce sync logs route is a read-only, tenant-scoped projection over sync runs, webhook receipts, and provider mappings."
  );
  assertFileIncludesAll(
    "src/routes/app/commerce-sync/logs/+page.svelte",
    ["Sync runs", "Webhook receipts", "Provider mappings", "idempotencyKey", "connectionName"],
    "Commerce sync logs page renders sanitized operational lists for provider sync audit."
  );
  for (const token of ["secretRef", "signature", "payload", "credentialsJson", "consumerSecret", "WOOCOMMERCE_CREDENTIALS_JSON", "WOOCOMMERCE_WEBHOOK_SECRET"]) {
    assert(
      !commerceSyncLogsServer.includes(token) && !commerceSyncLogsPage.includes(token),
      `Commerce sync logs route does not expose ${token}.`,
      `policy:commerce-sync-logs-redacts-${token}`
    );
  }
  assertFileIncludesAll(
    "package.json",
    ["generate:mcp", "mcp", "@microservices-sh/sdk-internal", "@modelcontextprotocol/sdk", "tsx"],
    "Commerce template can generate and run a governed MCP server for installed module tools."
  );
  assertFileIncludesAll(
    "scripts/generate-mcp.mjs",
    ["m.contract?.rpc", "generateToolManifest(m)", "templateId"],
    "Commerce MCP generator reads authoritative module rpc contracts from the template lockfile."
  );
  assert(
    !mcpGenerator.includes("loadConnections") && !mcpGenerator.includes("module.json"),
    "Commerce MCP generator does not merge unlocked module-manifest RPC connections.",
    "policy:commerce-mcp-lock-authoritative"
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
  assert(
    !mcpWiring.includes("payment_createPaymentIntent") && !mcpWiring.includes("org-team-rbac_authorize"),
    "Commerce MCP wiring does not expose handlers absent from the template lock RPC snapshot.",
    "policy:commerce-mcp-no-unlocked-handlers"
  );
  assertFileIncludesAll(
    "src/routes/app/agent/+page.server.ts",
    ["microservices.lock.json", "MODULE_BY_HREF", "toolName(moduleId, rpc.method)"],
    "Agent Center derives visible callable tools from lock-declared RPC methods."
  );
  assert(
    !agentCenter.includes("payment.refund") &&
      !agentCenter.includes("notification.send") &&
      !agentCenter.includes("webhook.deliver"),
    "Agent Center does not advertise hand-written tool names outside the lock-generated MCP surface.",
    "policy:commerce-agent-center-lock-tools"
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
      "confirmOrder",
      "cancelOrder",
      "createSalesOrderInventoryReservationPort",
      "upsertCustomer",
      "findProductBySku",
      "recordProviderMapping",
      "mappedStatus",
      "woocommerce:"
    ],
    "Commerce order import helper maps normalized WooCommerce orders into customer, product, sales-order, inventory lifecycle, and provider-mapping modules."
  );
  assertFileIncludesAll(
    "src/routes/app/sales-orders/+page.server.ts",
    ["createSalesOrderInventoryReservationPort", "releaseSalesOrderReservations", "confirmOrder", "releasedReservations"],
    "Sales order confirmation reserves stock through the inventory bridge before moving orders to confirmed, then releases reservations on terminal handoff."
  );
  assertFileIncludesAll(
    "src/routes/app/shipments/+page.server.ts",
    ["createShipmentInventoryPort", "completeShipment", "shipmentDocuments", "buildShipmentPrintDocument", "salesOrderIdsForShipment"],
    "Shipment completion uses the shared inventory bridge and exposes alias-aware, combo-expanded shipping context for packing slips."
  );
  assertFileIncludesAll(
    "src/lib/server/shipment-documents.ts",
    ["buildShipmentPrintDocument", "customerSnapshot", "expandProductComponents", "pickListPrintItems", "orderId"],
    "Shared shipment document context preserves sales-order snapshots, aliases, and combo-expanded pick lists for list and detail routes."
  );
  assertFileIncludesAll(
    "src/lib/server/shipment-inventory.ts",
    ["createShipmentInventoryPort", "resolveTrackedStockItems", "consumeReserved", "deductStock"],
    "Shipment inventory bridge expands combo products and consumes reserved component stock for sales-order-backed fulfillment."
  );
  assertFileIncludesAll(
    "src/lib/server/mcp-wiring.ts",
    ["createSalesOrderInventoryReservationPort", "releaseSalesOrderReservations", "createShipmentInventoryPort", "invoiceDraftPort"],
    "MCP commerce tools use the same inventory and invoice lifecycle bridges as the UI routes."
  );
  assertFileIncludesAll(
    "src/routes/app/shipments/+page.svelte",
    ["printShipmentPackingSlip", "printShipmentPickList", "pickItems", "Packing slip", "Pick list", "/app/shipments/${shipment.id}"],
    "Shipments page exposes StackSuite-style packing slip, pick-list, and detail route actions."
  );
  assertFileIncludesAll(
    "src/routes/app/shipments/[id]/+page.server.ts",
    ["getShipment", "buildShipmentPrintDocument", "completeShipment", "source: \"app/shipments/detail\""],
    "Shipment detail route resolves one batch through the module, reuses print document context, and completes through the inventory bridge."
  );
  assertFileIncludesAll(
    "src/routes/app/shipments/[id]/+page.svelte",
    ["printShipmentPackingSlip", "printShipmentPickList", "Packing slip", "Pick list", "Complete shipment", "shipment.items"],
    "Shipment detail page exposes printable documents, line review, and guarded completion."
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
    "microservices.lock.json",
    ["\"id\": \"email\"", "\"email.write\"", "\"beforeEmailSend\""],
    "Commerce template lock includes the email module used by login and invoice-send workflows."
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
    ["generateSalesOrderPrintHtml", "generateSalesOrderLedgerCsv", "generateSalesOrderLineItemsCsv", "printSalesOrder", "exportSalesOrder", "Export CSV", "?/cancel", "/app/sales-orders/${order.id}"],
    "Sales order ledger exposes row-level print, CSV, detail route, and cancellation actions."
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
    "src/routes/app/sales-orders/[id]/+page.server.ts",
    ["getOrder", "requireModule(\"sales-order\"", "requireOrgPermission", "\"org.read\""],
    "Sales order detail route loads one tenant-scoped order through the module under route-level read permission."
  );
  assert(
    !salesOrderDetailServer.includes("export const actions") &&
      !salesOrderDetailServer.includes("confirmOrder") &&
      !salesOrderDetailServer.includes("markOrderInvoiced") &&
      !salesOrderDetailServer.includes("cancelOrder") &&
      !salesOrderDetailServer.includes("listEvents"),
    "Sales order detail route remains read-only; lifecycle side effects stay on the ledger route.",
    "policy:commerce-sales-order-detail-read-only"
  );
  assertFileIncludesAll(
    "src/routes/app/sales-orders/[id]/+page.svelte",
    ["generateSalesOrderPrintHtml", "generateSalesOrderLineItemsCsv", "Print sales order", "Export line CSV", "Open ledger actions"],
    "Sales order detail page exposes read-only document review, print, and CSV actions."
  );
  assertFileIncludesAll(
    "src/routes/app/inventory/+page.server.ts",
    ["reconcileInventoryStock", "adjustStock", "reconcileStock", "operator-adjustment", "cycle-count", "inventory.stock_reconciled"],
    "Inventory route exposes receive, manual adjustment, and physical count reconciliation through the inventory module."
  );
  assertFileIncludesAll(
    "src/routes/app/inventory/+page.svelte",
    ["Adjust stock", "Reconcile count", "Recent counts & adjustments", "?/adjustStock", "?/reconcileStock"],
    "Inventory page exposes StackSuite receive/adjust/reconcile route proof for operators."
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
  assert(
    !hooksServer.includes("billingStore"),
    "Commerce request hook does not wire the removed billing store surface.",
    "policy:commerce-hook-no-billing-store"
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
