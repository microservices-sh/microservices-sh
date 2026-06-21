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
    slug: "booking-overlap-checker",
    name: "Booking overlap checker",
    purpose: "Detect booking slot conflicts and preserve adjacent-slot boundary behavior.",
    reuseMode: "adapt",
    signals: [/(booking|availability|calendar|slot)/i, /(overlap|conflict|available|availability|slot)/i],
    pathBonus: /(booking|availability|calendar|slot)/i,
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
  if (!heuristic.signals.every((signal) => signal.test(file.haystack))) return 0;
  const signalScore = heuristic.signals.reduce((score, signal) => score + (signal.test(file.haystack) ? 2 : 0), 0);
  return signalScore + (heuristic.pathBonus.test(file.lowerPath) ? 3 : 0);
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
