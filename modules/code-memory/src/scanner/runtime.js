const DEFAULT_MAX_CANDIDATES = 10;

const HEURISTICS = [
  {
    slug: "stripe-webhook-verifier",
    name: "Stripe webhook verifier",
    purpose: "Verify Stripe webhook signatures before parsing request JSON.",
    reuseMode: "adapt",
    signals: [/stripe/i, /webhook/i, /(signature|constructevent|stripe_webhook_secret)/i],
    pathBonus: /(stripe|billing).*webhook|webhook.*stripe/i,
    dependencies: ["stripe"],
    requiredEnv: ["STRIPE_WEBHOOK_SECRET"],
    inputs: ["Raw webhook body", "Stripe signature header"],
    outputs: ["Verified Stripe event"],
    usageNotes: "Port the signature verification sequence, tests, and failure behavior before adapting request handling.",
    constraints: ["Do not parse JSON before signature verification."],
    doNotUseFor: ["Webhook providers other than Stripe without a separate verifier."],
    testKeywords: ["stripe", "webhook", "signature"]
  },
  {
    slug: "invoice-numbering",
    name: "Invoice numbering",
    purpose: "Allocate tenant-scoped invoice numbers without duplicates.",
    reuseMode: "adapt",
    signals: [/invoice/i, /(number|sequence|allocator|nextinvoice|invoicenumber)/i],
    pathBonus: /invoice/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Tenant id", "Invoice series or period"],
    outputs: ["Next invoice number"],
    usageNotes: "Review transaction or reservation semantics before reuse.",
    constraints: ["Must remain tenant-scoped and race-safe."],
    doNotUseFor: ["Global invoice numbering requirements without jurisdiction-specific review."],
    testKeywords: ["invoice", "number", "sequence"]
  },
  {
    slug: "accounting-journal-posting",
    name: "Accounting journal posting",
    purpose: "Create, post, void, or report balanced double-entry journal entries.",
    reuseMode: "module",
    signals: [/(journal|ledger|trial\s*balance|chart\s*of\s*accounts|accounting)/i, /(debit|credit|balanced|post|void|fiscal)/i],
    pathBonus: /(accounting|journal|ledger|trial-balance|chart-of-accounts|fiscal)/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Tenant id", "Fiscal period", "Journal lines with debit and credit amounts"],
    outputs: ["Balanced journal entry, posting result, or trial balance"],
    usageNotes: "Port invariants and tests before adapting storage; ledger writes must stay immutable after posting.",
    constraints: ["Total debits must equal total credits.", "Posting and voiding require explicit approval."],
    doNotUseFor: ["Jurisdiction-specific tax or statutory reporting without separate review."],
    testKeywords: ["journal", "ledger", "debit", "credit", "trial balance"]
  },
  {
    slug: "bank-reconciliation-workflow",
    name: "Bank reconciliation workflow",
    purpose: "Import bank transactions, match them to ledger records, and close reconciliations with statement balances.",
    reuseMode: "module",
    signals: [/(bank|statement)/i, /(match|cleared|import|csv|ofx|reconcile|reconciliation|ending\s*balance)/i],
    requiredPath: /(bank|statement)/i,
    pathBonus: /(bank|reconciliation|statement|transaction|import)/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Bank account", "Statement dates and balances", "Imported bank transactions"],
    outputs: ["Matched transactions and reconciliation status"],
    usageNotes: "Adapt matching rules separately from storage so templates can expose review workflows without owning reconciliation internals.",
    constraints: ["Never auto-close a reconciliation with an unresolved difference."],
    doNotUseFor: ["Payment settlement or fraud review without additional controls."],
    testKeywords: ["bank", "reconciliation", "statement", "match"]
  },
  {
    slug: "recurring-invoice-generator",
    name: "Recurring invoice generator",
    purpose: "Generate due invoices or bills from recurring templates on a schedule.",
    reuseMode: "adapt",
    signals: [/(recurring|frequency|next_invoice_at|nextInvoiceAt|generateDue|next\s+invoice\s+at)/i, /(invoice|bill|template)/i],
    pathBonus: /(recurring|scheduled).*(invoice|bill)|(invoice|bill).*recurring/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Recurring template", "Current time", "Generation limit"],
    outputs: ["Generated invoices or bills and updated next-run state"],
    usageNotes: "Preserve idempotency and next-date calculation tests when adapting scheduled generation.",
    constraints: ["Generation must be idempotent for the same due window."],
    doNotUseFor: ["Subscription billing with external tax or payment mandates without provider-specific review."],
    testKeywords: ["recurring", "invoice", "bill", "schedule"]
  },
  {
    slug: "booking-overlap-checker",
    name: "Booking overlap checker",
    purpose: "Detect booking slot conflicts and preserve adjacent-slot boundary behavior.",
    reuseMode: "adapt",
    signals: [/(booking|calendar)/i, /(overlap|conflict|unavailable|availability)/i],
    requiredPath: /(booking|calendar|availability)/i,
    pathBonus: /(booking|availability|calendar)/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Requested time range", "Existing booking ranges"],
    outputs: ["Availability or conflict result"],
    usageNotes: "Reuse together with its boundary tests so adjacent slots keep the same behavior.",
    constraints: ["Must preserve boundary behavior for adjacent slots."],
    doNotUseFor: ["Recurring bookings without validating recurrence expansion first."],
    testKeywords: ["booking", "availability", "overlap", "slot"]
  },
  {
    slug: "d1-pagination-helper",
    name: "D1 pagination helper",
    purpose: "Build tenant-scoped D1 pagination queries with deterministic limits and cursors.",
    reuseMode: "adapt",
    signals: [/(d1|database|query)/i, /(cursor|pagination|limit|offset|pagesize)/i],
    pathBonus: /(d1|database|pagination|cursor)/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Tenant id", "Cursor or offset", "Page size"],
    outputs: ["Paginated query result"],
    usageNotes: "Keep query scoping and cursor ordering together when porting this helper.",
    constraints: ["Always include tenant_id in scoped queries."],
    doNotUseFor: ["Cross-tenant analytics queries without an explicit access policy."],
    testKeywords: ["d1", "pagination", "cursor", "limit"]
  },
  {
    slug: "woocommerce-sync-adapter",
    name: "WooCommerce sync adapter",
    purpose: "Sync WooCommerce customers, products, orders, categories, or webhooks into tenant-scoped commerce records.",
    reuseMode: "adapt",
    signals: [/(woocommerce|wcorder|wcproduct|wccustomer|wc_product|wc_order)/i, /(sync|webhook|externalSource|external_id|order|product|customer|signature)/i],
    pathBonus: /(woocommerce|commerce-sync|integrations\/sync|webhook)/i,
    dependencies: [],
    requiredEnv: ["WOOCOMMERCE_URL", "WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET"],
    inputs: ["WooCommerce credentials or webhook payload", "Tenant id"],
    outputs: ["Synced customers, products, orders, or categories"],
    usageNotes: "Separate credential parsing, webhook verification, and upsert mapping before adapting to commerce-sync ports.",
    constraints: ["Webhook signatures must be verified before processing payloads.", "External ids must be tenant-scoped."],
    doNotUseFor: ["Other commerce providers without a provider-specific adapter."],
    testKeywords: ["woocommerce", "webhook", "sync", "external"]
  },
  {
    slug: "shipment-inventory-reservation",
    name: "Shipment inventory reservation",
    purpose: "Reserve, release, and deduct inventory for invoiced orders and shipment batches.",
    reuseMode: "module",
    signals: [/(shipment|packing\s*slip|stock|inventory|reserved|onHand)/i, /(invoice_reserved|invoice_unreserved|stockMovements|stock\s*movement|pick\s*list|shipment\s*batch|batchId)/i],
    requiredPath: /(shipment|inventory|stock|packing)/i,
    pathBonus: /(shipment|inventory|stock|packing-slip|pick-list)/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Invoice or order lines", "Current stock balances", "Shipment batch"],
    outputs: ["Inventory reservations, stock movements, and shipment batch status"],
    usageNotes: "Keep reservation and release semantics together so invoice, inventory, and shipment modules do not drift.",
    constraints: ["Do not allow shipment deduction to drive available stock below zero unless explicitly configured."],
    doNotUseFor: ["Warehouse routing or carrier label purchase without separate fulfillment logic."],
    testKeywords: ["shipment", "inventory", "stock", "reservation"]
  },
  {
    slug: "printable-document-renderer",
    name: "Printable document renderer",
    purpose: "Generate printable invoice, sales order, or packing-slip HTML with escaping and filename helpers.",
    reuseMode: "adapt",
    signals: [/(generate.*html|print|html2pdf|packing\s*slip|sales\s*order)/i, /(escapeHtml|filename|document|download|printable)/i],
    pathBonus: /(print|pdf|packing-slip|sales-order|invoice)/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Document data", "Company settings", "Line items"],
    outputs: ["Escaped standalone HTML or print/download metadata"],
    usageNotes: "Port escaping and formatting tests with the renderer; UI templates can call this through module ports.",
    constraints: ["Never render unescaped customer or line-item text into HTML."],
    doNotUseFor: ["Legally compliant tax invoices without jurisdiction-specific template review."],
    testKeywords: ["print", "invoice", "packing", "escape"]
  },
  {
    slug: "auth-session-token-helper",
    name: "Auth session token helper",
    purpose: "Create or verify auth, session, JWT, or token helpers while preserving expiry semantics.",
    reuseMode: "adapt",
    signals: [/(auth|session|jwt|token)/i, /(verify|sign|expiry|expires|secret|cookie)/i],
    pathBonus: /(auth|session|jwt|token)/i,
    dependencies: [],
    requiredEnv: [],
    inputs: ["Credential, session, or token payload"],
    outputs: ["Signed token, verified claims, or session state"],
    usageNotes: "Review cryptographic algorithms, secret loading, and expiry behavior before reuse.",
    constraints: ["Do not silently change auth, signature, tenant, or expiry behavior."],
    doNotUseFor: ["New authentication protocols without a security review."],
    testKeywords: ["auth", "session", "jwt", "token"]
  }
];

function cleanPath(path) {
  const normalized = path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized.includes("..")) return null;
  return normalized;
}

function isTestPath(path) {
  return /(^|\/)(__tests__|test|tests)\//i.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(path);
}

function normalizeFile(file) {
  const path = cleanPath(file.path);
  if (!path) return null;
  const symbols = file.exportedSymbols?.join(" ") ?? "";
  const haystack = `${path} ${file.content ?? ""} ${symbols}`;
  return {
    path,
    lowerPath: path.toLowerCase(),
    haystack: haystack.toLowerCase(),
    isTest: isTestPath(path)
  };
}

function clampMaxCandidates(value) {
  if (value == null) return DEFAULT_MAX_CANDIDATES;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_MAX_CANDIDATES;
  return Math.min(value, 25);
}

function scoreFile(file, heuristic) {
  if (heuristic.requiredPath && !heuristic.requiredPath.test(file.lowerPath)) return 0;
  if (!heuristic.signals.every((signal) => signal.test(file.haystack))) return 0;
  const signalScore = heuristic.signals.reduce((score, signal) => score + (signal.test(file.haystack) ? 2 : 0), 0);
  const preferredCodePath = /^(src\/lib\/(db|integrations|server|utils)|src\/routes\/api|modules\/)/.test(file.lowerPath) ? 2 : 0;
  const docsPenalty = /^(docs|claudedocs)\//.test(file.lowerPath) || /\.(md)$/i.test(file.lowerPath) ? -3 : 0;
  const generatedPenalty = /(^|\/)(migrations\/meta|\.claude)\//.test(file.lowerPath) ? -2 : 0;
  const componentPenalty = /\/components\//.test(file.lowerPath) ? -1 : 0;
  return signalScore + (heuristic.pathBonus.test(file.lowerPath) ? 3 : 0) + preferredCodePath + docsPenalty + generatedPenalty + componentPenalty;
}

function fileBaseName(path) {
  const fileName = path.split("/").at(-1) ?? path;
  return fileName.replace(/\.(test|spec)?\.?[cm]?[jt]sx?$/i, "").toLowerCase();
}

function relatedTests(primaryPath, tests, heuristic) {
  const primaryBaseName = fileBaseName(primaryPath);
  return tests
    .filter((test) => {
      const testBaseName = fileBaseName(test.path);
      return testBaseName.includes(primaryBaseName) || primaryBaseName.includes(testBaseName) || heuristic.testKeywords.some((keyword) => test.haystack.includes(keyword));
    })
    .map((test) => test.path)
    .slice(0, 8);
}

function candidateForHeuristic(sourceId, files, tests, heuristic) {
  const matches = files
    .map((file) => ({ file, score: scoreFile(file, heuristic) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));

  const primary = matches[0]?.file;
  if (!primary) return null;

  const candidateFiles = matches.map((match) => match.file.path).slice(0, 8);
  return {
    sourceId,
    slug: heuristic.slug,
    name: heuristic.name,
    purpose: heuristic.purpose,
    reuseMode: heuristic.reuseMode,
    sourcePath: primary.path,
    files: candidateFiles,
    tests: relatedTests(primary.path, tests, heuristic),
    dependencies: heuristic.dependencies,
    requiredEnv: heuristic.requiredEnv,
    inputs: heuristic.inputs,
    outputs: heuristic.outputs,
    usageNotes: heuristic.usageNotes,
    constraints: heuristic.constraints,
    doNotUseFor: heuristic.doNotUseFor,
    approvalStatus: "candidate"
  };
}

export function suggestLogicCapsulesFromFiles(input) {
  const sourceId = input.sourceId.trim();
  const maxCandidates = clampMaxCandidates(input.maxCandidates);
  const normalized = input.files.map(normalizeFile).filter(Boolean).sort((a, b) => a.path.localeCompare(b.path));
  const sourceFiles = normalized.filter((file) => !file.isTest);
  const testFiles = normalized.filter((file) => file.isTest);
  const allCandidates = HEURISTICS.map((heuristic) => candidateForHeuristic(sourceId, sourceFiles, testFiles, heuristic)).filter(Boolean);
  const candidates = allCandidates.slice(0, maxCandidates);
  const scanSummary = {
    fileCount: normalized.length,
    candidateCount: candidates.length,
    truncated: allCandidates.length > candidates.length,
    skippedFileCount: input.files.length - normalized.length,
    maxCandidates,
    heuristics: candidates.map((candidate) => candidate.slug ?? candidate.name)
  };

  if (input.ref) scanSummary.ref = input.ref;
  if (input.commitSha) scanSummary.commitSha = input.commitSha;
  if (input.treeChecksum) scanSummary.treeChecksum = input.treeChecksum;

  return { candidates, scanSummary };
}
