const CONTRACT_VERSION = "2026-06-13";
const MODULE_SOURCE_REPO = "microservices-sh/microservices-sh";
const MODULE_SOURCE_URL = `https://github.com/${MODULE_SOURCE_REPO}.git`;

function moduleSurfaces({
  admin = null,
  visitor = null,
  agentic = null,
} = {}) {
  return {
    admin: admin ?? { applicable: false },
    visitor: visitor ?? { applicable: false },
    agentic: agentic ?? { applicable: false },
  };
}

function hookTiming(name) {
  if (name.startsWith("before")) return "pre";
  if (name.startsWith("calculate")) return "compute";
  return "post";
}

function catalogHook(name) {
  return {
    name,
    timing: hookTiming(name),
    purpose: `Extension point for ${name}.`,
  };
}

function standardQuality() {
  return {
    tests: { unit: true, integration: true, fixtures: true },
    agentDocs: true,
    migrations: true,
    upgradeNotes: true,
  };
}

function catalogModule({
  id,
  name,
  status,
  category = "core",
  approvalRisk = "medium",
  summary,
  requires = [],
  optional = [],
  storage = ["d1"],
  mount,
  bindings = ["DB"],
  surfaces = {},
  eventsEmitted = [],
  eventsConsumed = [],
  permissions,
  secrets = [],
  rpc = [],
  hooks = [],
  config = [],
  interactive = null,
  skills = [],
}) {
  const hookNames = hooks.map((hook) => (typeof hook === "string" ? hook : hook.name));
  return {
    id,
    name,
    version: "0.1.0",
    status,
    category,
    approvalRisk,
    summary,
    requires,
    optional,
    storage,
    runtime: {
      framework: "hono",
      mount,
      bindings,
    },
    surfaces: moduleSurfaces(surfaces),
    eventsEmitted,
    eventsConsumed,
    permissions,
    secrets,
    rpc,
    hooks: hooks.map((hook) => (typeof hook === "string" ? catalogHook(hook) : hook)),
    ...(interactive ? { interactive } : {}),
    ...(skills.length ? { skills } : {}),
    customization: {
      config,
      hooks: hookNames,
      forkable: true,
    },
    quality: standardQuality(),
  };
}

const INTERNAL_CATALOG_MODULES = Object.freeze([
  catalogModule({
    id: "product-catalog",
    name: "Product Catalog",
    status: "draft",
    summary: "Product and category catalog with SKU uniqueness, external mappings, combo products, and catalog events.",
    optional: ["auth", "audit-log"],
    mount: "/products",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Products", path: "/products", permission: "product-catalog.read", icon: "Package" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "product-catalog.listProducts",
          "product-catalog.getProduct",
          "product-catalog.createProduct",
          "product-catalog.updateProduct",
          "product-catalog.listCategories",
          "product-catalog.createCategory",
          "product-catalog.expandProductComponents",
        ],
        skillPaths: ["skills/product-catalog-operator/SKILL.md"],
        approvalRequired: [
          "product-catalog.createProduct",
          "product-catalog.updateProduct",
          "product-catalog.createCategory",
        ],
      },
    },
    eventsEmitted: [
      "product-catalog.category_created",
      "product-catalog.category_updated",
      "product-catalog.product_created",
      "product-catalog.product_updated",
      "product-catalog.combo_updated",
    ],
    permissions: [
      "product-catalog.read",
      "product-catalog.write",
      "product-catalog.admin",
      "product-catalog.extend",
      "product-catalog.observe",
    ],
    rpc: [
      { method: "listProducts", scope: "product-catalog.read", public: false },
      { method: "getProduct", scope: "product-catalog.read", public: false },
      { method: "createProduct", scope: "product-catalog.write", public: false },
      { method: "updateProduct", scope: "product-catalog.write", public: false },
      { method: "listCategories", scope: "product-catalog.read", public: false },
      { method: "createCategory", scope: "product-catalog.write", public: false },
      { method: "expandProductComponents", scope: "product-catalog.read", public: false },
    ],
    hooks: ["beforeCategoryCreate", "beforeProductCreate", "afterCategoryUpdated", "afterProductUpdated"],
    skills: [
      {
        id: "product-catalog-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/product-catalog-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "inventory",
    name: "Inventory",
    status: "draft",
    summary: "Tenant-scoped inventory ledger with stock movements, reservations, deductions, reconciliation, and derived balances.",
    requires: ["product-catalog"],
    optional: ["auth", "audit-log"],
    mount: "/inventory",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Inventory", path: "/inventory", permission: "inventory.read", icon: "Warehouse" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "inventory.getStockBalance",
          "inventory.listStockMovements",
          "inventory.stockIn",
          "inventory.reserveStock",
          "inventory.releaseReservation",
          "inventory.deductStock",
          "inventory.reconcileStock",
        ],
        approvalRequired: [
          "inventory.stockIn",
          "inventory.reserveStock",
          "inventory.releaseReservation",
          "inventory.deductStock",
          "inventory.reconcileStock",
        ],
      },
    },
    eventsEmitted: [
      "inventory.stock_received",
      "inventory.stock_reserved",
      "inventory.stock_released",
      "inventory.stock_deducted",
      "inventory.stock_reconciled",
    ],
    permissions: [
      "inventory.read",
      "inventory.write",
      "inventory.admin",
      "inventory.extend",
      "inventory.observe",
    ],
    rpc: [
      { method: "getStockBalance", scope: "inventory.read", public: false },
      { method: "listStockMovements", scope: "inventory.read", public: false },
      { method: "stockIn", scope: "inventory.write", public: false },
      { method: "reserveStock", scope: "inventory.write", public: false },
      { method: "releaseReservation", scope: "inventory.write", public: false },
      { method: "deductStock", scope: "inventory.write", public: false },
      { method: "reconcileStock", scope: "inventory.write", public: false },
    ],
    hooks: [
      "beforeStockIn",
      "beforeReservationCreate",
      "beforeReleaseCreate",
      "beforeDeductionCreate",
      "beforeReconciliation",
      "afterStockMovementRecorded",
    ],
  }),
  catalogModule({
    id: "sales-order",
    name: "Sales Order",
    status: "draft",
    summary: "Tenant-scoped sales orders with line items, external references, status transitions, reservation handoff, and invoice draft handoff.",
    optional: ["auth", "audit-log", "inventory", "invoice"],
    mount: "/sales-orders",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Sales Orders", path: "/sales-orders", permission: "sales-order.read", icon: "ShoppingCart" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "sales-order.listOrders",
          "sales-order.getOrder",
          "sales-order.createDraftOrder",
          "sales-order.confirmOrder",
          "sales-order.cancelOrder",
          "sales-order.markOrderInvoiced",
        ],
        skillPaths: ["skills/sales-order-operator/SKILL.md"],
        approvalRequired: [
          "sales-order.createDraftOrder",
          "sales-order.confirmOrder",
          "sales-order.cancelOrder",
          "sales-order.markOrderInvoiced",
        ],
      },
    },
    eventsEmitted: [
      "sales-order.order_created",
      "sales-order.order_confirmed",
      "sales-order.order_cancelled",
      "sales-order.order_invoiced",
    ],
    permissions: [
      "sales-order.read",
      "sales-order.write",
      "sales-order.admin",
      "sales-order.extend",
      "sales-order.observe",
    ],
    rpc: [
      { method: "listOrders", scope: "sales-order.read", public: false },
      { method: "getOrder", scope: "sales-order.read", public: false },
      { method: "createDraftOrder", scope: "sales-order.write", public: false },
      { method: "confirmOrder", scope: "sales-order.write", public: false },
      { method: "cancelOrder", scope: "sales-order.write", public: false },
      { method: "markOrderInvoiced", scope: "sales-order.write", public: false },
    ],
    hooks: [
      "beforeSalesOrderCreate",
      "beforeSalesOrderConfirm",
      "beforeSalesOrderCancel",
      "beforeSalesOrderInvoice",
      "afterSalesOrderUpdated",
    ],
    skills: [
      {
        id: "sales-order-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/sales-order-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "estimate-quote",
    name: "Estimate Quote",
    status: "draft",
    summary: "Estimate and quote documents with draft editing, lifecycle transitions, accepted conversion, and invoice draft handoff.",
    optional: ["auth", "audit-log", "invoice"],
    mount: "/estimate-quote",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Estimate Quote", path: "/estimate-quote", permission: "estimate-quote.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: ["estimate-quote.read", "estimate-quote.write"],
        skillPaths: ["skills/estimate-quote-operator/SKILL.md"],
        approvalRequired: ["estimate-quote.write"],
      },
    },
    eventsEmitted: [
      "estimate-quote.created",
      "estimate-quote.updated",
      "estimate-quote.sent",
      "estimate-quote.viewed",
      "estimate-quote.accepted",
      "estimate-quote.declined",
      "estimate-quote.expired",
      "estimate-quote.converted",
      "estimate-quote.voided",
    ],
    permissions: [
      "estimate-quote.read",
      "estimate-quote.write",
      "estimate-quote.admin",
      "estimate-quote.extend",
      "estimate-quote.observe",
    ],
    hooks: ["beforeEstimateQuoteCreate", "afterEstimateQuoteUpdated"],
    skills: [
      {
        id: "estimate-quote-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/estimate-quote-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "recurring-documents",
    name: "Recurring Documents",
    status: "draft",
    summary: "Recurring invoice and bill templates with due-cycle generation, lifecycle state, and draft document handoff.",
    optional: ["auth", "audit-log", "invoice", "accounts-payable", "jobs-workflows"],
    mount: "/recurring-documents",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Recurring Documents", path: "/recurring-documents", permission: "recurring-documents.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: ["recurring-documents.read", "recurring-documents.write"],
        skillPaths: ["skills/recurring-documents-operator/SKILL.md"],
        approvalRequired: ["recurring-documents.write"],
      },
    },
    eventsEmitted: [
      "recurring-documents.created",
      "recurring-documents.updated",
      "recurring-documents.paused",
      "recurring-documents.resumed",
      "recurring-documents.cancelled",
      "recurring-documents.completed",
      "recurring-documents.generated",
    ],
    permissions: [
      "recurring-documents.read",
      "recurring-documents.write",
      "recurring-documents.admin",
      "recurring-documents.extend",
      "recurring-documents.observe",
    ],
    hooks: ["beforeRecurringDocumentsCreate", "afterRecurringDocumentsUpdated"],
    skills: [
      {
        id: "recurring-documents-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/recurring-documents-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "shipment",
    name: "Shipment",
    status: "draft",
    summary: "Shipment batches and fulfillment workflow with idempotent completion and shipment events.",
    optional: ["auth", "audit-log"],
    mount: "/shipments",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Shipments", path: "/shipments", permission: "shipment.read", icon: "Truck" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "shipment.listShipments",
          "shipment.getShipment",
          "shipment.createShipment",
          "shipment.completeShipment",
          "shipment.cancelShipment",
        ],
        skillPaths: ["skills/shipment-operator/SKILL.md"],
        approvalRequired: [
          "shipment.createShipment",
          "shipment.completeShipment",
          "shipment.cancelShipment",
        ],
      },
    },
    eventsEmitted: ["shipment.created", "shipment.completed", "shipment.cancelled"],
    permissions: ["shipment.read", "shipment.write", "shipment.admin", "shipment.extend", "shipment.observe"],
    rpc: [
      { method: "listShipments", scope: "shipment.read", public: false },
      { method: "getShipment", scope: "shipment.read", public: false },
      { method: "createShipment", scope: "shipment.write", public: false },
      { method: "completeShipment", scope: "shipment.write", public: false },
      { method: "cancelShipment", scope: "shipment.write", public: false },
    ],
    hooks: ["beforeShipmentCreate", "beforeShipmentComplete", "afterShipmentUpdated"],
    skills: [
      {
        id: "shipment-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/shipment-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "commerce-sync",
    name: "Commerce Sync",
    status: "draft",
    approvalRisk: "high",
    summary: "Provider-neutral commerce connections, mappings, sync runs, webhook receipts, and normalized payload envelopes.",
    optional: ["auth", "audit-log"],
    mount: "/commerce-sync",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Commerce Sync", path: "/commerce-sync", permission: "commerce-sync.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "commerce-sync.createCommerceConnection",
          "commerce-sync.recordProviderMapping",
          "commerce-sync.startSyncRun",
          "commerce-sync.completeSyncRun",
          "commerce-sync.recordWebhookReceipt",
          "commerce-sync.normalizeCommercePayload",
          "commerce-sync.syncWooCommercePage",
        ],
        skillPaths: ["skills/commerce-sync-operator/SKILL.md"],
        approvalRequired: [
          "commerce-sync.createCommerceConnection",
          "commerce-sync.recordProviderMapping",
          "commerce-sync.startSyncRun",
          "commerce-sync.completeSyncRun",
          "commerce-sync.recordWebhookReceipt",
          "commerce-sync.normalizeCommercePayload",
          "commerce-sync.syncWooCommercePage",
        ],
      },
    },
    eventsEmitted: [
      "commerce-sync.connection_created",
      "commerce-sync.mapping_recorded",
      "commerce-sync.sync_started",
      "commerce-sync.sync_completed",
      "commerce-sync.webhook_recorded",
      "commerce-sync.payload_normalized",
    ],
    permissions: [
      "commerce-sync.read",
      "commerce-sync.write",
      "commerce-sync.admin",
      "commerce-sync.extend",
      "commerce-sync.observe",
    ],
    hooks: [
      "beforeCommerceConnectionCreate",
      "beforeCommerceSyncRun",
      "beforeCommerceWebhookRecord",
      "afterCommercePayloadNormalized",
    ],
    skills: [
      {
        id: "commerce-sync-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/commerce-sync-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "accounting-core",
    name: "Accounting Core",
    status: "draft",
    summary: "Tenant-scoped double-entry accounting foundation with chart of accounts, fiscal periods, balanced posting, voiding, and trial balance.",
    optional: ["auth", "audit-log"],
    mount: "/accounting",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Accounting", path: "/accounting", permission: "accounting-core.read", icon: "Landmark" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "accounting-core.listAccounts",
          "accounting-core.createAccount",
          "accounting-core.createFiscalPeriod",
          "accounting-core.createJournalEntry",
          "accounting-core.postJournalEntry",
          "accounting-core.voidJournalEntry",
          "accounting-core.getTrialBalance",
        ],
        skillPaths: ["skills/accounting-core-operator/SKILL.md"],
        approvalRequired: [
          "accounting-core.createAccount",
          "accounting-core.createFiscalPeriod",
          "accounting-core.postJournalEntry",
          "accounting-core.voidJournalEntry",
        ],
      },
    },
    eventsEmitted: [
      "accounting-core.account_created",
      "accounting-core.fiscal_period_created",
      "accounting-core.fiscal_period_status_changed",
      "accounting-core.journal_entry_created",
      "accounting-core.journal_entry_updated",
      "accounting-core.journal_entry_posted",
      "accounting-core.journal_entry_voided",
    ],
    permissions: [
      "accounting-core.read",
      "accounting-core.write",
      "accounting-core.admin",
      "accounting-core.extend",
      "accounting-core.observe",
    ],
    hooks: [
      "beforeAccountCreate",
      "beforeFiscalPeriodCreate",
      "beforeJournalEntryCreate",
      "beforeJournalEntryPost",
      "beforeJournalEntryVoid",
      "afterJournalEntryChanged",
    ],
    skills: [
      {
        id: "accounting-core-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/accounting-core-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "invoice",
    name: "Invoice",
    status: "available",
    approvalRisk: "high",
    summary: "Invoices with gapless atomic numbering, per-line tax, recurring invoice templates, an enforced draft->open->paid->void lifecycle, idempotent payment application, payment-link metadata, and dunning hooks.",
    requires: ["customer"],
    optional: ["payment", "email", "audit-log", "jobs-workflows"],
    mount: "/invoices",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Invoices", path: "/invoices", permission: "invoice.read", icon: "FileText" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "invoices",
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "invoice.listInvoices",
          "invoice.getInvoice",
          "invoice.issueInvoice",
          "invoice.recordPayment",
          "invoice.createPaymentLink",
          "invoice.createRecurringTemplate",
          "invoice.listRecurringTemplates",
          "invoice.updateRecurringTemplateStatus",
          "invoice.generateDueRecurringInvoices",
          "invoice.voidInvoice",
        ],
        skillPaths: ["skills/invoice-operator/SKILL.md"],
        approvalRequired: [
          "invoice.issueInvoice",
          "invoice.recordPayment",
          "invoice.createPaymentLink",
          "invoice.createRecurringTemplate",
          "invoice.updateRecurringTemplateStatus",
          "invoice.generateDueRecurringInvoices",
          "invoice.voidInvoice",
        ],
      },
    },
    eventsEmitted: [
      "invoice.created",
      "invoice.issued",
      "invoice.paid",
      "invoice.voided",
      "invoice.overdue",
      "invoice.payment_link_created",
      "invoice.recurring_template_created",
      "invoice.recurring_template_status_updated",
      "invoice.recurring_invoice_generated",
    ],
    permissions: ["invoice.read", "invoice.write", "invoice.admin", "invoice.extend", "invoice.observe"],
    hooks: ["beforeInvoiceIssue", "onInvoiceIssued", "onInvoicePaid"],
    skills: [
      {
        id: "invoice-operator",
        path: "skills/invoice-operator/SKILL.md",
        recommendedFor: ["admin-operations", "billing-support", "money-mutations"],
      },
    ],
  }),
  catalogModule({
    id: "accounts-payable",
    name: "Accounts Payable",
    status: "draft",
    approvalRisk: "high",
    summary: "Tenant-scoped accounts payable with vendors, bills, payable lifecycle, idempotent payment application, aging, recurring bill templates, and accounting-core handoff ports.",
    optional: ["auth", "accounting-core", "audit-log", "jobs-workflows"],
    mount: "/payables",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Payables", path: "/payables", permission: "accounts-payable.read", icon: "Receipt" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "accounts-payable.listVendors",
          "accounts-payable.createVendor",
          "accounts-payable.createBill",
          "accounts-payable.markBillPayable",
          "accounts-payable.recordBillPayment",
          "accounts-payable.getAgingReport",
          "accounts-payable.createRecurringBillTemplate",
          "accounts-payable.listRecurringBillTemplates",
          "accounts-payable.updateRecurringBillTemplateStatus",
          "accounts-payable.generateDueRecurringBills",
        ],
        skillPaths: ["skills/accounts-payable-operator/SKILL.md"],
        approvalRequired: [
          "accounts-payable.createBill",
          "accounts-payable.markBillPayable",
          "accounts-payable.recordBillPayment",
          "accounts-payable.createRecurringBillTemplate",
          "accounts-payable.updateRecurringBillTemplateStatus",
          "accounts-payable.generateDueRecurringBills",
        ],
      },
    },
    eventsEmitted: [
      "accounts-payable.vendor_created",
      "accounts-payable.bill_created",
      "accounts-payable.bill_marked_payable",
      "accounts-payable.bill_payment_recorded",
      "accounts-payable.bill_paid",
      "accounts-payable.recurring_bill_template_created",
      "accounts-payable.recurring_bill_template_status_updated",
      "accounts-payable.recurring_bill_generated",
    ],
    permissions: [
      "accounts-payable.read",
      "accounts-payable.write",
      "accounts-payable.pay",
      "accounts-payable.admin",
      "accounts-payable.extend",
      "accounts-payable.observe",
    ],
    hooks: [
      "beforeVendorCreate",
      "beforeBillCreate",
      "beforeBillMarkPayable",
      "afterBillPayable",
      "afterBillPaymentRecorded",
      "afterVendorCreated",
    ],
    skills: [
      {
        id: "accounts-payable-operator",
        recommendedFor: ["admin-operations", "money-mutations", "agentic-tools"],
        path: "skills/accounts-payable-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "accounts-receivable",
    name: "Accounts Receivable",
    status: "draft",
    summary: "Tenant-scoped customer payment application, open receivables, aging, and statement workflows.",
    requires: ["customer", "invoice"],
    optional: ["auth", "audit-log", "payment", "accounting-core"],
    mount: "/receivables",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Accounts Receivable", path: "/receivables", permission: "accounts-receivable.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "accounts-receivable.recordCustomerPayment",
          "accounts-receivable.applyPaymentToInvoices",
          "accounts-receivable.listOpenReceivables",
          "accounts-receivable.generateAgedReceivables",
          "accounts-receivable.produceCustomerStatement",
        ],
        skillPaths: ["skills/accounts-receivable-operator/SKILL.md"],
        approvalRequired: [
          "accounts-receivable.recordCustomerPayment",
          "accounts-receivable.applyPaymentToInvoices",
        ],
      },
    },
    eventsEmitted: [
      "accounts-receivable.customer_payment_recorded",
      "accounts-receivable.payment_applied",
    ],
    permissions: [
      "accounts-receivable.read",
      "accounts-receivable.write",
      "accounts-receivable.admin",
      "accounts-receivable.extend",
      "accounts-receivable.observe",
    ],
    hooks: [
      "beforeCustomerPaymentRecord",
      "beforePaymentApply",
      "afterCustomerPaymentRecorded",
      "afterPaymentApplied",
    ],
    skills: [
      {
        id: "accounts-receivable-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/accounts-receivable-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "bank-reconciliation",
    name: "Bank Reconciliation",
    status: "draft",
    summary: "Tenant-scoped bank accounts, statement imports, matching, and reconciliation completion with integer-cent balances.",
    optional: ["auth", "audit-log", "accounting-core", "payment"],
    mount: "/banking",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Banking", path: "/banking", permission: "bank-reconciliation.read", icon: "Landmark" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "bank-reconciliation.createBankAccount",
          "bank-reconciliation.listBankAccounts",
          "bank-reconciliation.listStatementImports",
          "bank-reconciliation.importStatementCsv",
          "bank-reconciliation.importStatementTransactions",
          "bank-reconciliation.suggestMatches",
          "bank-reconciliation.createMatch",
          "bank-reconciliation.startReconciliation",
          "bank-reconciliation.completeReconciliation",
        ],
        skillPaths: ["skills/bank-reconciliation-operator/SKILL.md"],
        approvalRequired: [
          "bank-reconciliation.createBankAccount",
          "bank-reconciliation.importStatementCsv",
          "bank-reconciliation.importStatementTransactions",
          "bank-reconciliation.createMatch",
          "bank-reconciliation.startReconciliation",
          "bank-reconciliation.completeReconciliation",
        ],
      },
    },
    eventsEmitted: [
      "bank-reconciliation.bank_account_created",
      "bank-reconciliation.statement_imported",
      "bank-reconciliation.match_created",
      "bank-reconciliation.reconciliation_started",
      "bank-reconciliation.reconciliation_completed",
    ],
    eventsConsumed: [
      "accounting-core.journal_entry_posted",
      "payment.succeeded",
      "payment.refunded",
    ],
    permissions: [
      "bank-reconciliation.read",
      "bank-reconciliation.write",
      "bank-reconciliation.admin",
      "bank-reconciliation.extend",
      "bank-reconciliation.observe",
    ],
    hooks: [
      "beforeBankAccountCreate",
      "beforeStatementImport",
      "beforeMatchCreate",
      "beforeReconciliationStart",
      "beforeReconciliationComplete",
      "afterReconciliationChanged",
    ],
    skills: [
      {
        id: "bank-reconciliation-operator",
        recommendedFor: ["admin-operations", "agentic-tools", "finance-operations"],
        path: "skills/bank-reconciliation-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "email",
    name: "Email",
    status: "available",
    category: "provider",
    summary: "Transactional email module with provider-neutral ports and Resend and StackSuite (AWS SES) HTTP adapters.",
    optional: ["auth", "audit-log", "customer"],
    mount: "/emails",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Email", path: "/settings/email", permission: "email.read", icon: "Mail" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: ["email.sendEmail"],
        skillPaths: ["skills/email-operator/SKILL.md"],
        approvalRequired: ["email.sendEmail"],
      },
    },
    eventsEmitted: ["email.queued", "email.sent", "email.failed"],
    permissions: ["email.read", "email.write", "email.admin", "email.extend"],
    secrets: ["RESEND_API_KEY", "EMAIL_SERVICE_API_KEY"],
    hooks: ["beforeEmailSend", "afterEmailQueued", "afterEmailFailed"],
    skills: [
      {
        id: "microservices-provider-setup",
        recommendedFor: ["provider-setup", "sender-domain", "deliverability"],
      },
      {
        id: "email-operator",
        path: "skills/email-operator/SKILL.md",
        recommendedFor: ["admin-operations", "provider-setup", "deliverability"],
      },
    ],
  }),
]);

const MODULES = Object.freeze([
  {
    id: "auth",
    name: "Auth",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "EdDSA service-token mint/verify, scope checks, and JWKS for auth-gated inter-service communication.",
    requires: [],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/auth",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Auth", path: "/settings/auth", permission: "auth.admin" }],
      },
      agentic: {
        applicable: true,
        tools: ["auth.mintToken", "auth.verifyToken", "auth.getJwks"],
        approvalRequired: ["auth.mintToken", "auth.rotateSigningKey"],
      },
    }),
    eventsEmitted: ["auth.token_minted", "auth.key_rotated"],
    eventsConsumed: [],
    permissions: ["auth.mint", "auth.verify", "auth.admin"],
    rpc: [
      { method: "mintToken", scope: "auth.mint", public: false },
      { method: "verifyToken", scope: "auth.verify", public: false },
      { method: "getJwks", scope: null, public: true },
    ],
    hooks: [
      {
        name: "beforeMintToken",
        timing: "pre",
        purpose: "Clamp or narrow requested scopes and ttl before signing.",
      },
      {
        name: "afterTokenMinted",
        timing: "post",
        purpose: "Observe or augment a minted token result.",
      },
    ],
    customization: {
      config: ["defaultTtlSeconds", "issuer", "jwksCacheSeconds"],
      hooks: ["beforeMintToken", "afterTokenMinted"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "identity",
    name: "Identity",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "Passwordless email-code login and server-side sessions backed by auth-scoped service tokens.",
    requires: ["auth"],
    optional: ["email", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "sveltekit",
      mount: "/identity",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Identity", path: "/settings/identity", permission: "identity.admin", icon: "UserRoundCog" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "login",
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "identity.requestLoginCode",
          "identity.verifyLoginCode",
          "identity.readSession",
          "identity.destroySession",
        ],
        skillPaths: ["skills/identity-operator/SKILL.md"],
        approvalRequired: [
          "identity.requestLoginCode",
          "identity.verifyLoginCode",
          "identity.destroySession",
        ],
      },
    }),
    eventsEmitted: [
      "identity.login_code_issued",
      "identity.login_verified",
      "identity.session_created",
      "identity.session_destroyed",
    ],
    eventsConsumed: [],
    permissions: [
      "identity.login",
      "identity.session",
      "identity.admin",
      "identity.extend",
      "identity.observe",
    ],
    rpc: [
      { method: "requestLoginCode", scope: "identity.login", public: false },
      { method: "verifyLoginCode", scope: "identity.login", public: false },
      { method: "readSession", scope: "identity.session", public: false },
      { method: "destroySession", scope: "identity.session", public: false },
    ],
    hooks: [
      {
        name: "beforeVerifyCode",
        timing: "pre",
        purpose: "Guard login code verification before a session is created.",
      },
      {
        name: "afterSessionCreated",
        timing: "post",
        purpose: "Observe session creation for audit, notification, or login support workflows.",
      },
    ],
    customization: {
      config: ["sessionTtlSeconds", "loginCodeTtlSeconds"],
      hooks: ["beforeVerifyCode", "afterSessionCreated"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "gateway",
    name: "Gateway",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "Public trust boundary: API-key authentication, rate limiting, scope narrowing, and token exchange via auth.",
    requires: ["auth"],
    optional: ["audit-log"],
    storage: ["d1", "kv"],
    runtime: {
      framework: "hono",
      mount: "/gateway",
      bindings: ["DB", "RATE_LIMIT_KV"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Gateway", path: "/settings/api-keys", permission: "gateway.admin" }],
      },
      agentic: {
        applicable: true,
        tools: ["gateway.issueToken", "gateway.inspectRateLimit"],
        approvalRequired: ["gateway.issueToken", "gateway.createApiKey", "gateway.revokeApiKey"],
      },
    }),
    eventsEmitted: ["gateway.token_issued", "gateway.access_denied"],
    eventsConsumed: [],
    permissions: ["gateway.admin"],
    rpc: [],
    hooks: [
      {
        name: "beforeIssueToken",
        timing: "pre",
        purpose: "Narrow scopes, attach claims, or reject issuance before minting.",
      },
      {
        name: "afterTokenIssued",
        timing: "post",
        purpose: "Observe issued tokens for analytics or audit.",
      },
    ],
    customization: {
      config: ["tokenTtlSeconds", "rateLimit", "rateWindowSeconds"],
      hooks: ["beforeIssueToken", "afterTokenIssued"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "customer",
    name: "Customer",
    version: "0.1.0",
    status: "available",
    category: "core",
    summary: "Customer profiles, tags, lifecycle state, consent fields, and customer events.",
    requires: ["auth"],
    optional: ["email", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/customers",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Customers", path: "/customers", permission: "customer.read", icon: "Users" }],
      },
      visitor: {
        applicable: true,
        featureKey: "memberProfile",
      },
      agentic: {
        applicable: true,
        tools: ["customer.getCustomer", "customer.listCustomers", "customer.upsertCustomer"],
        approvalRequired: ["customer.upsertCustomer", "customer.deleteCustomer"],
      },
    }),
    eventsEmitted: ["customer.created", "customer.updated"],
    eventsConsumed: [],
    permissions: ["customer.read", "customer.write", "customer.admin"],
    rpc: [
      { method: "getCustomer", scope: "customer.read", public: false },
      { method: "listCustomers", scope: "customer.read", public: false },
      { method: "upsertCustomer", scope: "customer.write", public: false },
    ],
    hooks: [
      {
        name: "beforeCustomerCreate",
        timing: "pre",
        purpose: "Normalize incoming customer data and enforce business-specific required fields.",
      },
      {
        name: "afterCustomerUpdated",
        timing: "post",
        purpose: "Sync customer changes to external CRMs or notification flows.",
      },
    ],
    customization: {
      config: ["profileFields", "tags", "segments", "consentFields"],
      hooks: ["beforeCustomerCreate", "afterCustomerUpdated"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  ...INTERNAL_CATALOG_MODULES,
  {
    id: "booking",
    name: "Booking",
    version: "0.1.0",
    status: "available",
    category: "vertical",
    summary: "Service booking, availability, cancellation windows, confirmation, and booking events.",
    requires: ["auth", "customer"],
    optional: ["payment", "email", "staff", "audit-log"],
    storage: ["d1", "kv"],
    runtime: {
      framework: "hono",
      mount: "/bookings",
      bindings: ["DB", "CACHE_KV", "NOTIFICATIONS"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Bookings", path: "/bookings", permission: "booking.read", icon: "CalendarDays" }],
      },
      visitor: {
        applicable: true,
        featureKey: "spaces",
      },
      agentic: {
        applicable: true,
        tools: ["booking.listBookings", "booking.getBooking", "booking.getAvailability", "booking.createBooking", "booking.cancelBooking"],
        approvalRequired: ["booking.createBooking", "booking.cancelBooking"],
      },
    }),
    eventsEmitted: ["booking.created", "booking.confirmed", "booking.cancelled"],
    eventsConsumed: ["customer.created", "payment.succeeded"],
    permissions: ["booking.read", "booking.write", "booking.admin"],
    rpc: [
      { method: "listBookings", scope: "booking.read", public: false },
      { method: "getBooking", scope: "booking.read", public: false },
      { method: "getAvailability", scope: "booking.read", public: false },
    ],
    hooks: [
      {
        name: "beforeBookingCreate",
        timing: "pre",
        purpose: "Validate booking rules before a booking record is created.",
      },
      {
        name: "calculateAvailability",
        timing: "compute",
        purpose: "Replace or adjust generated availability slots with business-specific rules.",
      },
      {
        name: "afterBookingConfirmed",
        timing: "post",
        purpose: "Run post-confirmation workflows such as reminders or payment capture.",
      },
    ],
    customization: {
      config: [
        "serviceTypes",
        "slotIntervalMinutes",
        "defaultDurationMinutes",
        "leadTimeMinutes",
        "cancellationWindowHours",
        "allowWaitlist",
      ],
      hooks: ["beforeBookingCreate", "calculateAvailability", "afterBookingConfirmed"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "audit-log",
    name: "Audit Log",
    version: "0.1.0",
    status: "available",
    category: "sink",
    summary: "Append-only audit trail. Pure event sink: records domain events from a signed queue or direct calls.",
    requires: [],
    optional: [],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/audit",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Audit Log", path: "/settings/audit-log", permission: "audit.read" }],
      },
      agentic: {
        applicable: true,
        tools: ["audit.listEvents", "audit.exportEvents"],
        approvalRequired: ["audit.exportEvents"],
      },
    }),
    eventsEmitted: ["audit.recorded", "audit.exported"],
    eventsConsumed: [],
    permissions: ["audit.read", "audit.export", "audit.admin"],
    rpc: [],
    hooks: [
      {
        name: "redactAuditPayload",
        timing: "pre",
        purpose: "Redact or drop sensitive fields before an audit record is persisted.",
      },
      {
        name: "beforeAuditExport",
        timing: "pre",
        purpose: "Filter or guard an audit export request.",
      },
    ],
    customization: {
      config: ["requireSignedEnvelope", "defaultListLimit"],
      hooks: ["redactAuditPayload", "beforeAuditExport"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "payment",
    name: "Payment",
    version: "0.1.0",
    status: "available",
    category: "provider",
    summary: "Stripe-backed payment provider: create payment intents, record payments, and verify signed Stripe webhooks. Emits payment lifecycle events.",
    requires: ["auth", "customer"],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/payments",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Payments", path: "/payments", permission: "payment.read", icon: "CreditCard" }],
      },
      visitor: {
        applicable: true,
        featureKey: "payments",
      },
      agentic: {
        applicable: true,
        tools: ["payment.createPaymentIntent", "payment.listPayments", "payment.refundPayment"],
        approvalRequired: ["payment.createPaymentIntent", "payment.refundPayment"],
      },
    }),
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    eventsEmitted: ["payment.checkout_created", "payment.succeeded", "payment.refunded", "payment.failed"],
    eventsConsumed: [],
    permissions: ["payment.read", "payment.write", "payment.admin"],
    rpc: [
      { method: "createPaymentIntent", scope: "payment.write", public: false },
    ],
    hooks: [
      {
        name: "beforeCreatePaymentIntent",
        timing: "pre",
        purpose: "Adjust or validate intent input before the gateway call.",
      },
      {
        name: "afterPaymentSucceeded",
        timing: "post",
        purpose: "Run side-effects after a payment is marked succeeded.",
      },
    ],
    customization: {
      config: ["defaultCurrency", "requireWebhookSecret", "defaultListLimit"],
      hooks: ["beforeCreatePaymentIntent", "afterPaymentSucceeded"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "billing-subscriptions",
    name: "Billing & Subscriptions",
    version: "0.1.0",
    status: "available",
    category: "provider",
    approvalRisk: "high",
    summary:
      "Recurring plans and subscription state on top of Stripe: a complete status state machine, idempotent webhook application, plan changes, metered usage, and dunning hooks.",
    requires: [],
    optional: ["payment", "org-team-rbac", "jobs-workflows", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/billing",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Billing", path: "/settings/billing", permission: "billing.read", icon: "Receipt" }],
      },
      agentic: {
        applicable: true,
        tools: ["billing.listPlans", "billing.startSubscription", "billing.changePlan", "billing.cancelSubscription"],
        approvalRequired: ["billing.startSubscription", "billing.changePlan", "billing.cancelSubscription"],
      },
    }),
    eventsEmitted: [
      "subscription.started",
      "subscription.activated",
      "subscription.past_due",
      "subscription.canceled",
      "subscription.plan_changed",
    ],
    eventsConsumed: [],
    permissions: [
      "billing.read",
      "billing.write",
      "billing.admin",
      "billing-subscriptions.extend",
      "billing-subscriptions.observe",
    ],
    rpc: [
      { method: "startSubscription", scope: "billing.write", public: false },
      { method: "applyStripeEvent", scope: "billing.write", public: false },
    ],
    hooks: [
      {
        name: "beforeSubscriptionChange",
        timing: "pre",
        purpose: "Guard or adjust a subscription transition before it is persisted.",
      },
      {
        name: "onSubscriptionActivated",
        timing: "post",
        purpose: "Observe activation to grant access, notify users, or update downstream records.",
      },
      {
        name: "onSubscriptionPastDue",
        timing: "post",
        purpose: "Observe past-due transitions to start dunning or restrict risky operations.",
      },
    ],
    customization: {
      config: ["plans", "trialDays", "usageMeters", "dunning"],
      hooks: ["beforeSubscriptionChange", "onSubscriptionActivated", "onSubscriptionPastDue"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "idempotency",
    name: "Idempotency",
    version: "0.1.0",
    status: "available",
    category: "core",
    summary: "Scoped idempotency records for safe retry, replay, and duplicate side-effect prevention.",
    requires: [],
    optional: ["audit-log", "jobs-workflows"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/idempotency",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      agentic: {
        applicable: true,
        tools: ["idempotency.getRecord", "idempotency.inspectReplay"],
      },
    }),
    eventsEmitted: [
      "idempotency.claimed",
      "idempotency.replayed",
      "idempotency.completed",
      "idempotency.failed",
      "idempotency.expired_pruned",
    ],
    eventsConsumed: [],
    permissions: ["idempotency.claim", "idempotency.read", "idempotency.admin"],
    rpc: [
      { method: "claimIdempotency", scope: "idempotency.claim", public: false },
      { method: "getIdempotencyRecord", scope: "idempotency.read", public: false },
    ],
    hooks: [
      {
        name: "beforeIdempotencyClaim",
        timing: "pre",
        purpose: "Validate, enrich, or reject a claim before it is persisted or replayed.",
      },
      {
        name: "afterIdempotencyComplete",
        timing: "post",
        purpose: "Observe a completed idempotency record for audit or activity feeds.",
      },
      {
        name: "onIdempotencyReplay",
        timing: "post",
        purpose: "Observe terminal record replay without creating a duplicate side effect.",
      },
    ],
    customization: {
      config: ["defaultTtlMs", "defaultLockTtlMs", "maxTtlMs"],
      hooks: ["beforeIdempotencyClaim", "afterIdempotencyComplete", "afterIdempotencyFail", "onIdempotencyReplay"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "webhook-delivery",
    name: "Webhook Delivery",
    version: "0.1.0",
    status: "available",
    category: "sink",
    summary: "Outbound mirror of the event bus: registers external endpoints (per-endpoint signing secret), delivers HMAC-signed domain events, and logs delivery attempts.",
    requires: [],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/webhooks",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Webhooks", path: "/settings/webhooks", permission: "webhook.read" }],
      },
      agentic: {
        applicable: true,
        tools: ["webhook.listEndpoints", "webhook.registerEndpoint", "webhook.deliverTestEvent"],
        approvalRequired: ["webhook.registerEndpoint", "webhook.deliverTestEvent"],
      },
    }),
    // External outbound HTTP side-effects make this approval-gated despite being
    // a sink (audit-log, also a sink, stays medium — it never leaves the account).
    approvalRisk: "high",
    secrets: [],
    eventsEmitted: ["webhook.delivered", "webhook.failed"],
    eventsConsumed: [],
    permissions: ["webhook.read", "webhook.write", "webhook.admin"],
    rpc: [],
    hooks: [
      {
        name: "beforeWebhookDeliver",
        timing: "pre",
        purpose: "Adjust or drop an outbound event before delivery.",
      },
      {
        name: "afterWebhookDelivered",
        timing: "post",
        purpose: "Observe a delivery attempt result.",
      },
    ],
    customization: {
      config: ["defaultListLimit", "maxRetries"],
      hooks: ["beforeWebhookDeliver", "afterWebhookDelivered"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "document-extraction",
    name: "Document Extraction",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary:
      "Local-first scanned document extraction: file references, OCR/LLM drafts, schema normalization, source evidence, human review, and governed Gemma/AI fallback.",
    requires: [],
    optional: ["auth", "org-team-rbac", "audit-log", "file-media", "forms-intake", "ai-gateway", "jobs-workflows", "invoice", "customer", "support-ticket"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/documents",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Documents", path: "/documents", permission: "document-extraction.read", icon: "FileText" }],
      },
      visitor: {
        applicable: true,
        featureKey: "documentIntake",
      },
      agentic: {
        applicable: true,
        tools: [
          "document-extraction.createExtractionJob",
          "document-extraction.submitExtractionDraft",
          "document-extraction.reviewExtraction",
          "document-extraction.getExtractionJob",
          "document-extraction.listExtractionJobs",
          "document-extraction.normalizeExtraction",
        ],
        approvalRequired: [
          "document-extraction.reviewExtraction",
          "document-extraction.normalizeExtraction",
          "document-extraction.modelDownload",
          "ai-gateway.complete",
        ],
      },
    }),
    eventsEmitted: [
      "document-extraction.job_created",
      "document-extraction.draft_submitted",
      "document-extraction.approved",
      "document-extraction.rejected",
      "document-extraction.failed",
    ],
    eventsConsumed: [],
    permissions: [
      "document-extraction.read",
      "document-extraction.write",
      "document-extraction.review",
      "document-extraction.admin",
      "document-extraction.extend",
      "document-extraction.observe",
    ],
    rpc: [
      { method: "createExtractionJob", scope: "document-extraction.write", public: false },
      { method: "submitExtractionDraft", scope: "document-extraction.write", public: false },
      { method: "reviewExtraction", scope: "document-extraction.review", public: false },
      { method: "getExtractionJob", scope: "document-extraction.read", public: false },
      { method: "listExtractionJobs", scope: "document-extraction.read", public: false },
      { method: "normalizeExtraction", scope: "document-extraction.write", public: false },
    ],
    hooks: [
      {
        name: "beforeExtractionJobCreate",
        timing: "pre",
        purpose: "Guard document intake, schema selection, and file references before a review job is created.",
      },
      {
        name: "beforeExtractionDraftSubmit",
        timing: "pre",
        purpose: "Reject or adjust OCR/LLM drafts before they enter the review queue.",
      },
      {
        name: "afterExtractionReviewed",
        timing: "post",
        purpose: "Observe approval/rejection for audit, notifications, or target-record creation.",
      },
    ],
    customization: {
      config: ["mode", "reviewRequired", "minConfidenceForApproval", "localBrowser", "gatewayFallback", "sidecar"],
      hooks: ["beforeExtractionJobCreate", "beforeExtractionDraftSubmit", "afterExtractionReviewed"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "code-memory",
    name: "Code Memory",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary: "Trusted Sources, immutable source versions, Logic Capsules, and audit events for private reusable code memory.",
    requires: ["identity"],
    optional: ["audit-log", "jobs-workflows"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/code-memory",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Code Memory", path: "/code-memory", permission: "code-memory.read", icon: "DatabaseZap" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "code-memory.addTrustedSource",
          "code-memory.listTrustedSources",
          "code-memory.recordSourceScan",
          "code-memory.createLogicCapsule",
          "code-memory.searchLogicCapsules",
          "code-memory.getLogicCapsule",
          "code-memory.approveLogicCapsule",
          "code-memory.rejectLogicCapsule",
        ],
        skillPaths: ["skills/code-memory-operator/SKILL.md"],
        approvalRequired: [
          "code-memory.addTrustedSource",
          "code-memory.recordSourceScan",
          "code-memory.createLogicCapsule",
          "code-memory.approveLogicCapsule",
          "code-memory.rejectLogicCapsule",
        ],
      },
    }),
    eventsEmitted: [
      "code-memory.source.added",
      "code-memory.source.scanned",
      "code-memory.capsule.created",
      "code-memory.capsule.approved",
      "code-memory.capsule.rejected",
      "code-memory.capsule.retrieved",
    ],
    eventsConsumed: [],
    permissions: [
      "code-memory.read",
      "code-memory.write",
      "code-memory.approve",
      "code-memory.admin",
      "code-memory.observe",
    ],
    rpc: [
      { method: "addTrustedSource", scope: "code-memory.write", public: false },
      { method: "listTrustedSources", scope: "code-memory.read", public: false },
      { method: "recordSourceScan", scope: "code-memory.write", public: false },
      { method: "createLogicCapsule", scope: "code-memory.write", public: false },
      { method: "searchLogicCapsules", scope: "code-memory.read", public: false },
      { method: "getLogicCapsule", scope: "code-memory.read", public: false },
      { method: "approveLogicCapsule", scope: "code-memory.approve", public: false },
      { method: "rejectLogicCapsule", scope: "code-memory.approve", public: false },
    ],
    hooks: [
      {
        name: "beforeTrustedSourceAdd",
        timing: "pre",
        purpose: "Guard repository URL, visibility, and allowed paths before adding a Trusted Source.",
      },
      {
        name: "beforeLogicCapsuleCreate",
        timing: "pre",
        purpose: "Reject or adjust candidate capsule metadata before persistence.",
      },
      {
        name: "afterLogicCapsuleRetrieved",
        timing: "post",
        purpose: "Observe approved capsule retrieval for audit or usage reporting.",
      },
    ],
    customization: {
      config: ["defaultProvider", "maxAllowedPaths"],
      hooks: ["beforeTrustedSourceAdd", "beforeLogicCapsuleCreate", "afterLogicCapsuleRetrieved"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "operator-work",
    name: "Operator Work",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary: "Agent-readable task board, focus plan, daily review, and auditable operator work state for DOT AI OS.",
    requires: [],
    optional: ["org-team-rbac", "audit-log", "jobs-workflows", "calendar-google", "email"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/operator-work",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Operator Work", path: "/operator-work", permission: "operator-work.read", icon: "ListTodo" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "operator-work.getOperatorWorkbench",
          "operator-work.listOperatorTasks",
          "operator-work.upsertOperatorTask",
          "operator-work.updateOperatorTaskStatus",
          "operator-work.listFocusBlocks",
          "operator-work.upsertFocusBlock",
          "operator-work.listDailyReviews",
          "operator-work.saveDailyReview",
        ],
        skillPaths: ["skills/operator-work-operator/SKILL.md"],
        approvalRequired: [
          "operator-work.upsertOperatorTask",
          "operator-work.updateOperatorTaskStatus",
          "operator-work.upsertFocusBlock",
          "operator-work.saveDailyReview",
        ],
      },
    }),
    eventsEmitted: [
      "operator-work.task.upserted",
      "operator-work.task.status_changed",
      "operator-work.focus_block.upserted",
      "operator-work.daily_review.saved",
    ],
    eventsConsumed: [],
    permissions: [
      "operator-work.read",
      "operator-work.write",
      "operator-work.admin",
      "operator-work.extend",
      "operator-work.observe",
    ],
    rpc: [
      { method: "getOperatorWorkbench", scope: "operator-work.read", public: false },
      { method: "listOperatorTasks", scope: "operator-work.read", public: false },
      { method: "upsertOperatorTask", scope: "operator-work.write", public: false },
      { method: "updateOperatorTaskStatus", scope: "operator-work.write", public: false },
      { method: "listFocusBlocks", scope: "operator-work.read", public: false },
      { method: "upsertFocusBlock", scope: "operator-work.write", public: false },
      { method: "listDailyReviews", scope: "operator-work.read", public: false },
      { method: "saveDailyReview", scope: "operator-work.write", public: false },
    ],
    hooks: [
      {
        name: "beforeOperatorTaskUpsert",
        timing: "pre",
        purpose: "Normalize or guard task writes before persistence.",
      },
      {
        name: "afterOperatorTaskUpdated",
        timing: "post",
        purpose: "Observe created or updated tasks for audit, notifications, or agent handoff workflows.",
      },
      {
        name: "beforeFocusBlockUpsert",
        timing: "pre",
        purpose: "Normalize or guard focus plan writes before persistence.",
      },
      {
        name: "beforeDailyReviewSave",
        timing: "pre",
        purpose: "Normalize or guard daily review saves before persistence.",
      },
    ],
    customization: {
      config: ["maxTasks", "allowAgentDrafts", "requireReviewBeforeUnlock"],
      hooks: ["beforeOperatorTaskUpsert", "afterOperatorTaskUpdated", "beforeFocusBlockUpsert", "beforeDailyReviewSave"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
]);

const TEMPLATES = Object.freeze([
  {
    id: "booking-business",
    name: "Booking Business",
    version: "0.1.0",
    status: "available",
    summary: "A bookable service business foundation for studios, clinics, consultants, and local operators.",
    targetCustomer: "AI-heavy agencies, consultants, and technical founders building custom booking systems.",
    defaultModules: ["gateway", "auth", "customer", "booking"],
    optionalModules: ["email", "payment", "admin", "audit-log", "idempotency", "webhook-delivery"],
    targetRuntime: {
      language: "typescript",
      framework: "hono",
      platform: "cloudflare-workers",
      storage: ["d1", "kv"],
    },
    defaultConfig: {
      appName: "Booking Business",
      appSlug: "booking-business",
      timezone: "UTC",
      currency: "USD",
      auth: {
        defaultRole: "member",
        sessionTtlSeconds: 604800,
      },
      customer: {
        profileFields: ["name", "email", "phone", "notes"],
        consentFields: ["emailMarketingConsent"],
      },
      booking: {
        serviceTypes: ["consultation", "standard-service"],
        slotIntervalMinutes: 30,
        defaultDurationMinutes: 60,
        leadTimeMinutes: 120,
        cancellationWindowHours: 24,
        maxFutureDays: 90,
        allowWaitlist: false,
      },
    },
    successCriteria: [
      "Generated Hono Worker can run locally with Wrangler.",
      "Generated schema includes account, customer, booking, event, and audit tables.",
      "Hooks are explicit files an agent can customize without changing module internals.",
      "Module lock records exact module versions used for upgrade comparison.",
    ],
  },
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function createContractError(code, message, remediation, details = {}) {
  const error = new Error(message);
  error.name = "MicroservicesContractError";
  error.code = code;
  error.remediation = remediation;
  error.details = details;
  return error;
}

function moduleSummary(module) {
  return {
    id: module.id,
    name: module.name,
    version: module.version,
    status: module.status,
    category: module.category,
    summary: module.summary,
    requires: clone(module.requires),
    mount: module.runtime.mount,
    ...(module.interactive ? { interactive: clone(module.interactive) } : {}),
    ...(module.skills ? { skills: clone(module.skills) } : {}),
    ...(module.surfaces ? { surfaces: clone(module.surfaces) } : {}),
  };
}

function templateSummary(template) {
  return {
    id: template.id,
    name: template.name,
    version: template.version,
    status: template.status,
    summary: template.summary,
    defaultModules: clone(template.defaultModules),
    optionalModules: clone(template.optionalModules),
    ...(template.interactive ? { interactive: clone(template.interactive) } : {}),
    ...(template.skills ? { skills: clone(template.skills) } : {}),
  };
}

function findById(items, id, kind) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw createContractError(
      `${kind.toUpperCase()}_NOT_FOUND`,
      `Unknown ${kind}: ${id}`,
      `Run "${kind}s list --json" and select one of the returned ids.`,
      { id }
    );
  }
  return item;
}

export function parseModuleRef(value, explicitVersion = null) {
  const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  const at = raw.lastIndexOf("@");
  const inline =
    at > 0
      ? {
          id: raw.slice(0, at),
          version: raw.slice(at + 1) || null,
        }
      : {
          id: raw,
          version: null,
        };
  const version = explicitVersion ? String(explicitVersion).trim() : inline.version;

  if (inline.version && explicitVersion && inline.version !== String(explicitVersion).trim()) {
    throw createContractError(
      "MODULE_VERSION_CONFLICT",
      `Conflicting versions requested for module ${inline.id}.`,
      "Use either module@version or --version/--to, not both with different versions.",
      { moduleId: inline.id, inlineVersion: inline.version, explicitVersion: String(explicitVersion).trim() }
    );
  }

  return {
    id: inline.id,
    version,
    raw,
  };
}

export function availableModuleVersions(id) {
  const versions = MODULES.filter((candidate) => candidate.id === id).map((module) => module.version);
  if (!versions.length) {
    throw createContractError(
      "MODULE_NOT_FOUND",
      `Unknown module: ${id}`,
      'Run "modules list --json" and select one of the returned ids.',
      { id }
    );
  }
  return unique(versions);
}

function findModuleByRef(ref, explicitVersion = null) {
  const selector = parseModuleRef(ref, explicitVersion);
  const candidates = MODULES.filter((candidate) => candidate.id === selector.id);
  if (!candidates.length) {
    throw createContractError(
      "MODULE_NOT_FOUND",
      `Unknown module: ${selector.id}`,
      'Run "modules list --json" and select one of the returned ids.',
      { id: selector.id }
    );
  }

  const module = selector.version
    ? candidates.find((candidate) => candidate.version === selector.version)
    : candidates[candidates.length - 1];
  if (!module) {
    throw createContractError(
      "MODULE_VERSION_NOT_FOUND",
      `Module ${selector.id}@${selector.version} is not available in this registry snapshot.`,
      "Select one of the available versions or omit the version to use the current registry version.",
      {
        id: selector.id,
        moduleId: selector.id,
        requestedVersion: selector.version,
        availableVersions: candidates.map((candidate) => candidate.version),
      }
    );
  }

  return module;
}

function moduleRefString(module) {
  return `${module.id}@${module.version}`;
}

export function moduleReleaseTag(id, version) {
  return `modules/${id}/v${version}`;
}

export function moduleSourceRef(input, version = null) {
  const module = typeof input === "string" ? { id: input, version } : input;
  return {
    type: "git",
    repo: MODULE_SOURCE_REPO,
    url: MODULE_SOURCE_URL,
    tag: moduleReleaseTag(module.id, module.version),
    ref: `refs/tags/${moduleReleaseTag(module.id, module.version)}`,
    path: `modules/${module.id}`,
  };
}

function resolveModuleRefs(moduleRefs) {
  const explicitVersions = new Map();
  for (const value of moduleRefs) {
    const ref = parseModuleRef(value);
    if (!ref.id || !ref.version) continue;
    const existing = explicitVersions.get(ref.id);
    if (existing && existing !== ref.version) {
      throw createContractError(
        "MODULE_VERSION_CONFLICT",
        `Conflicting versions requested for module ${ref.id}.`,
        "Request a single version for each module.",
        { moduleId: ref.id, requestedVersions: [existing, ref.version] }
      );
    }
    explicitVersions.set(ref.id, ref.version);
  }

  const visited = new Set();
  const ordered = [];

  function visit(value) {
    const ref = parseModuleRef(value);
    const version = explicitVersions.get(ref.id) ?? ref.version;
    const module = findModuleByRef(ref.id, version);
    if (visited.has(module.id)) return;
    visited.add(module.id);
    for (const requiredId of module.requires) {
      visit(requiredId);
    }
    ordered.push(module);
  }

  for (const moduleRef of moduleRefs) {
    visit(moduleRef);
  }

  return ordered;
}

function mergeConfig(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return clone(base);
  }

  const output = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeConfig(output[key], value);
    } else {
      output[key] = clone(value);
    }
  }
  return output;
}

export function listModules() {
  return MODULES.map((module) => ({
    ...moduleSummary(module),
    latestVersion: module.version,
    availableVersions: availableModuleVersions(module.id),
    sourceRef: moduleSourceRef(module),
  }));
}

export function inspectModule(id) {
  return clone(findModuleByRef(id));
}

export function listTemplates() {
  return TEMPLATES.map(templateSummary);
}

export function inspectTemplate(id) {
  return clone(findById(TEMPLATES, id, "template"));
}

export function resolveModuleIds(moduleIds) {
  return resolveModuleRefs(moduleIds).map((module) => module.id);
}

export function createModuleLock(modules, template = null) {
  return {
    schemaVersion: CONTRACT_VERSION,
    generatedAt: "deterministic-local-preview",
    registry: {
      id: "microservices.sh",
      contractVersion: CONTRACT_VERSION,
    },
    generator: {
      package: "create-microservices-app",
      version: "0.0.0",
    },
    template: template
      ? {
          id: template.id,
          version: template.version,
          source: `registry:${template.id}@${template.version}`,
          checksum: `sha256:preview-${template.id}-${template.version}`,
        }
      : null,
    // App-level deploy topology (plans/24). Default is embedded; service mode is
    // opt-in and recorded per-module below.
    deploy: { mode: "embedded" },
    modules: modules.map((module) => ({
      id: module.id,
      version: module.version,
      source: `registry:${module.id}@${module.version}`,
      sourceRef: moduleSourceRef(module),
      checksum: `sha256:preview-${module.id}-${module.version}`,
      customizationMode: "config-hooks",
      // Per-module topology. In service mode this also carries worker + d1 names.
      mode: "embedded",
      contract: {
        mount: module.runtime.mount,
        bindings: clone(module.runtime.bindings),
        resources: module.storage.map((item) => item.toUpperCase()),
        permissions: clone(module.permissions),
        rpc: clone(module.rpc ?? []),
        hooks: module.hooks.map((hook) => hook.name),
        events: unique([...module.eventsEmitted, ...module.eventsConsumed]),
        requires: clone(module.requires),
        secrets: clone(module.secrets ?? []),
        surfaces: clone(module.surfaces ?? {}),
      },
    })),
    customizations: {
      config: true,
      hooks: modules.flatMap((module) => module.customization?.hooks ?? []),
      overlays: [],
      forks: [],
    },
  };
}

export function composeApp(input = {}) {
  const options = typeof input === "string" ? { templateId: input } : input;
  const templateId = options.templateId ?? options.template ?? "booking-business";
  const template = inspectTemplate(templateId);
  const requestedModules = unique([
    ...template.defaultModules,
    ...(options.modules ?? []),
  ]);
  const modules = resolveModuleRefs(requestedModules).map(clone);
  const resolvedModuleIds = modules.map((module) => module.id);
  const config = mergeConfig(template.defaultConfig, options.config);

  return {
    schemaVersion: CONTRACT_VERSION,
    compositionId: `cmp_${template.id}_${modules.map(moduleRefString).join("_")}`,
    template: templateSummary(template),
    config,
    modules,
    routes: modules.map((module) => ({
      module: module.id,
      mount: module.runtime.mount,
      framework: module.runtime.framework,
    })),
    bindings: unique(modules.flatMap((module) => module.runtime.bindings)),
    storage: unique(modules.flatMap((module) => module.storage)),
    permissions: unique(modules.flatMap((module) => module.permissions)),
    events: {
      emitted: unique(modules.flatMap((module) => module.eventsEmitted)),
      consumed: unique(modules.flatMap((module) => module.eventsConsumed)),
    },
    hooks: modules.flatMap((module) =>
      module.hooks.map((hook) => ({
        module: module.id,
        ...hook,
      }))
    ),
    checks: [
      "module-contract",
      "dependency-resolution",
      "worker-bindings",
      "schema-presence",
      "hook-surface",
      "audit-events",
    ],
    upgradePolicy: {
      mode: "contract-lock",
      lockfile: "microservices.lock.json",
      compatibleCustomization: ["config", "hooks"],
      manualCustomization: ["fork", "export"],
    },
    lock: createModuleLock(modules, template),
  };
}

export { CONTRACT_VERSION };
