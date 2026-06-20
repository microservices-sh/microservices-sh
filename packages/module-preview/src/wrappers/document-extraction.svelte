<script lang="ts">
  // Interactive wrapper for document-extraction. The live product would call
  // file-media, browser OCR, a local Gemma runtime, and review use cases. This
  // wrapper keeps those side effects simulated and approval-gated for preview.
  import Preview from "@microservices-sh/document-extraction/preview";

  type ExtractionMode = "local-only" | "hybrid" | "sidecar" | "gateway-only";
  type RuntimeId = "browser-local" | "sidecar-ollama" | "sidecar-openai-compatible" | "gateway";
  type ModelStatus = "not-installed" | "downloading" | "installed" | "connected" | "offline" | "available";

  let { module: m }: { module: any } = $props();

  const samples = [
    { id: "doc_invoice", name: "acme-supplies-invoice.pdf", targetType: "invoice", mimeType: "application/pdf", pages: 2, bytes: 840_000 },
    { id: "doc_receipt", name: "warehouse-receipt.jpg", targetType: "receipt", mimeType: "image/jpeg", pages: 1, bytes: 2_100_000 },
    { id: "doc_support", name: "damaged-shipment-evidence.png", targetType: "support-evidence", mimeType: "image/png", pages: 1, bytes: 1_480_000 }
  ];

  let models = $state([
    {
      id: "gemma4-e2b-browser",
      label: "Gemma 4 E2B local",
      runtime: "browser-local" as RuntimeId,
      model: "gemma-4-e2b-q4-browser",
      size: "2.9 GB",
      status: "not-installed" as ModelStatus,
      progress: 0,
      approvalRequired: true
    },
    {
      id: "gemma4-12b-ollama",
      label: "Gemma 4 12B sidecar",
      runtime: "sidecar-ollama" as RuntimeId,
      model: "gemma4:12b-q4",
      size: "8.4 GB",
      status: "offline" as ModelStatus,
      endpoint: "127.0.0.1:11434",
      approvalRequired: true
    },
    {
      id: "gemma4-gateway",
      label: "Gemma 4 gateway fallback",
      runtime: "gateway" as RuntimeId,
      model: "gemma-4-12b",
      size: "remote",
      status: "available" as ModelStatus,
      endpoint: "ai-gateway",
      approvalRequired: true
    }
  ]);

  let jobSeq = 2;
  let jobs = $state<any[]>([
    {
      id: "dex_001",
      documentName: "northwind-invoice.pdf",
      targetType: "invoice",
      status: "needs_review",
      mode: "hybrid",
      runtime: "sidecar-ollama",
      model: "gemma4:12b-q4",
      confidence: 0.88,
      warnings: ["Tax ID is partially obscured on page 1."],
      fields: [
        { name: "vendor", value: "Northwind Supplies", confidence: 0.97, source: "page 1, header" },
        { name: "invoiceNumber", value: "NW-1048", confidence: 0.92, source: "page 1, top right" },
        { name: "dueDate", value: "2026-07-15", confidence: 0.85, source: "page 1, payment terms", needsReview: true },
        { name: "total", value: 1284.5, confidence: 0.9, source: "page 2, totals table" }
      ],
      createdAt: new Date(Date.now() - 18e5).toISOString()
    }
  ]);

  function updateModel(id: string, patch: Partial<{ status: ModelStatus; progress: number }>) {
    models = models.map((model) => (model.id === id ? { ...model, ...patch } : model));
  }

  function ondownload(modelId: string) {
    updateModel(modelId, { status: "downloading", progress: 8 });
    const timer = window.setInterval(() => {
      const current = models.find((model) => model.id === modelId);
      if (!current || current.status !== "downloading") {
        window.clearInterval(timer);
        return;
      }
      const next = Math.min(100, (current.progress ?? 0) + 23);
      updateModel(modelId, next >= 100 ? { status: "installed", progress: 100 } : { progress: next });
      if (next >= 100) window.clearInterval(timer);
    }, 350);
  }

  function onconnect(modelId: string) {
    updateModel(modelId, { status: "connected" });
  }

  function fieldsFor(targetType: string) {
    if (targetType === "receipt") {
      return [
        { name: "merchant", value: "Warehouse Market", confidence: 0.95, source: "top logo" },
        { name: "date", value: "2026-06-18", confidence: 0.9, source: "receipt line 4" },
        { name: "total", value: 74.32, confidence: 0.93, source: "bottom total" },
        { name: "paymentMethod", value: "card", confidence: 0.72, source: "bottom footer", needsReview: true }
      ];
    }
    if (targetType === "support-evidence") {
      return [
        { name: "incidentType", value: "damaged shipment", confidence: 0.86, source: "image annotation" },
        { name: "carrier", value: "FreightCo", confidence: 0.78, source: "label crop", needsReview: true },
        { name: "trackingNumber", value: "FC99281045", confidence: 0.89, source: "package label" },
        { name: "summary", value: "Box corner crushed; contents exposed.", confidence: 0.84, source: "visual evidence" }
      ];
    }
    return [
      { name: "vendor", value: "Acme Supplies", confidence: 0.96, source: "page 1, header" },
      { name: "invoiceNumber", value: "AC-2026-0192", confidence: 0.94, source: "page 1, top right" },
      { name: "dueDate", value: "2026-07-20", confidence: 0.87, source: "page 1, payment terms" },
      { name: "total", value: 3420.75, confidence: 0.91, source: "page 2, totals table" }
    ];
  }

  function onextract(input: { documentId: string; modelId: string; mode: ExtractionMode; schemaId: string; runtime: RuntimeId }) {
    const document = samples.find((sample) => sample.id === input.documentId);
    const model = models.find((candidate) => candidate.id === input.modelId);
    if (!document || !model) return;
    jobs = [
      {
        id: `dex_${String(jobSeq++).padStart(3, "0")}`,
        documentName: document.name,
        targetType: input.schemaId,
        status: "needs_review",
        mode: input.mode,
        runtime: input.runtime,
        model: model.model,
        confidence: input.runtime === "gateway" ? 0.9 : 0.86,
        warnings: input.runtime === "gateway" ? ["Gateway fallback requires audit review before applying output."] : ["One field is below auto-approval confidence."],
        fields: fieldsFor(input.schemaId),
        createdAt: new Date().toISOString()
      },
      ...jobs
    ];
  }

  function onapprove(jobId: string) {
    jobs = jobs.map((job) => (job.id === jobId ? { ...job, status: "approved", warnings: [] } : job));
  }

  function onreject(jobId: string) {
    jobs = jobs.map((job) => (job.id === jobId ? { ...job, status: "rejected" } : job));
  }
</script>

<Preview {samples} {models} {jobs} {ondownload} {onconnect} {onextract} {onapprove} {onreject} />
