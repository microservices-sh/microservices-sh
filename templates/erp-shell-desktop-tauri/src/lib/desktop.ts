import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export type RuntimeStatus = {
  ocr: "ready" | "missing" | "checking";
  llm: "ready" | "missing" | "checking";
  model: string;
  mode: "browser-preview" | "tauri";
  ocrEngine?: string;
  llmEngine?: string;
};

export type RuntimeSettings = {
  gemmaModel: string;
  ocrLanguage: string;
  suggestedModels: string[];
  installedModels: string[];
  selectedModelInstalled: boolean;
  ollamaInstalled: boolean;
};

export type ModelInstallResult = {
  model: string;
  output: string;
  settings: RuntimeSettings;
};

export type ModelProbeResult = {
  model: string;
  ready: boolean;
  latencyMs: number;
  output: string;
  warnings: string[];
};

export type ImportStatus = {
  baseUrl: string;
  state: "connected" | "not-configured" | "offline";
  pendingDrafts: number;
  importedDrafts: number;
  tokenConfigured: boolean;
};

export type ErpImportSettings = {
  baseUrl: string;
  tokenConfigured: boolean;
};

type DesktopImportRequest = {
  endpoint: string;
  token: string;
  payload: Record<string, unknown>;
};

export type ImportFolder = {
  path: string;
  documentCount: number;
  newDocuments: number;
  duplicateDocuments: number;
  skippedDocuments: number;
};

export type ImportResult = {
  folder: ImportFolder;
  jobs: QueueJob[];
};

export type QueueJob = {
  id: string;
  name: string;
  kind: "invoice" | "intake" | "support";
  status: "ready" | "extracting" | "review" | "approved" | "rejected" | "synced";
  confidence: number;
  pages: number;
  fileHash: string;
  path: string;
  importedAt: number;
  draft: ExtractionDraft | null;
};

export type SourceRegion = {
  page?: number;
  text?: string;
};

export type ExtractedField = {
  name: string;
  value: string | number | boolean | null;
  confidence: number;
  source?: SourceRegion | null;
  needsReview?: boolean | null;
};

export type ExtractedTable = {
  name: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  confidence: number;
  source?: SourceRegion | null;
};

export type ExtractionDraft = {
  schemaId: string;
  targetType: "invoice" | "receipt" | "intake-form" | "customer-document" | "support-evidence" | "custom";
  fields: ExtractedField[];
  tables: ExtractedTable[];
  rawText?: string | null;
  summary?: string | null;
  confidence: number;
  runtime: "browser-ocr" | "browser-local-llm" | "ai-gateway" | "sidecar";
  model?: string | null;
  warnings: string[];
};

export type ExtractionResult = {
  job: QueueJob;
  draft: ExtractionDraft;
};

async function call<T>(command: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error(`Desktop command unavailable: ${command}`);
  }
}

export async function getRuntimeStatus() {
  return call<RuntimeStatus>("runtime_status", undefined, {
    ocr: "ready",
    llm: "ready",
    model: "gemma4:e4b",
    mode: "browser-preview",
    ocrEngine: "gemma vision",
    llmEngine: "ollama"
  });
}

export async function getRuntimeSettings() {
  return call<RuntimeSettings>("runtime_settings", undefined, sampleRuntimeSettings());
}

export async function saveRuntimeSettings(gemmaModel: string, ocrLanguage: string) {
  return call<RuntimeSettings>(
    "save_runtime_settings",
    { gemmaModel, ocrLanguage },
    {
      ...sampleRuntimeSettings(),
      gemmaModel,
      ocrLanguage
    }
  );
}

export async function installGemmaModel(model: string) {
  return call<ModelInstallResult>(
    "install_gemma_model",
    { model },
    {
      model,
      output: "Preview mode does not download models.",
      settings: {
        ...sampleRuntimeSettings(),
        gemmaModel: model,
        installedModels: Array.from(new Set([...sampleRuntimeSettings().installedModels, model])),
        selectedModelInstalled: true
      }
    }
  );
}

export async function testGemmaModel(model: string) {
  return call<ModelProbeResult>(
    "test_gemma_model",
    { model },
    {
      model,
      ready: true,
      latencyMs: 42,
      output: "ready",
      warnings: ["Browser preview uses sample runtime data; run Tauri desktop mode to test Ollama."]
    }
  );
}

export async function getImportStatus() {
  return call<ImportStatus>("import_status", undefined, {
    baseUrl: "http://localhost:5173",
    state: "not-configured",
    pendingDrafts: 1,
    importedDrafts: 1,
    tokenConfigured: false
  });
}

export async function getSyncStatus() {
  return getImportStatus();
}

export async function getErpImportSettings() {
  return call<ErpImportSettings>("erp_import_settings", undefined, {
    baseUrl: "http://localhost:5173",
    tokenConfigured: false
  });
}

export async function saveErpImportSettings(baseUrl: string, token: string) {
  return call<ErpImportSettings>(
    "save_erp_import_settings",
    { baseUrl, token },
    { baseUrl: baseUrl.trim().replace(/\/+$/, ""), tokenConfigured: Boolean(token.trim()) }
  );
}

export async function submitApprovedDraft(jobId: string) {
  const request = await call<DesktopImportRequest>("desktop_import_request", { jobId });
  const headers: Record<string, string> = {
    authorization: `Bearer ${request.token}`,
    "content-type": "application/json"
  };
  try {
    const hostname = new URL(request.endpoint).hostname;
    if (hostname.endsWith(".ngrok-free.app") || hostname.endsWith(".ngrok.app")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }
  } catch {
    // Let fetch surface malformed endpoint URLs.
  }
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(request.payload)
  });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || body?.ok !== true) {
    throw new Error(body?.error ?? `ERP import failed with HTTP ${response.status}`);
  }
  return call<QueueJob>("mark_job_imported", { jobId }, { ...previewJob(jobId), status: "synced" });
}

export async function selectImportFolder() {
  return call<ImportResult | null>(
    "select_import_folder",
    undefined,
    previewImportResult("~/Documents/client-imports")
  );
}

export async function selectImportFiles() {
  return call<ImportResult | null>(
    "select_import_files",
    undefined,
    previewImportResult("~/Documents/client-imports/selected-files")
  );
}

export async function importDocumentPaths(paths: string[]) {
  const jobs = sampleDocuments();

  return call<ImportResult>(
    "import_document_paths",
    { paths },
    {
      folder: {
        path: paths.length === 1 ? paths[0] : `${paths.length} dropped items`,
        documentCount: jobs.length,
        newDocuments: jobs.length,
        duplicateDocuments: 0,
        skippedDocuments: 0
      },
      jobs
    }
  );
}

export async function listenForDroppedDocuments(
  onDrop: (paths: string[]) => void | Promise<void>,
  onActiveChange: (active: boolean) => void
): Promise<UnlistenFn> {
  try {
    return await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        onActiveChange(true);
        return;
      }

      if (event.payload.type === "drop") {
        onActiveChange(false);
        void onDrop(event.payload.paths);
        return;
      }

      onActiveChange(false);
    });
  } catch {
    return () => undefined;
  }
}

export async function loadQueueDocuments() {
  return call<QueueJob[]>("queue_documents", undefined, sampleDocuments());
}

export async function extractDocument(jobId: string) {
  const jobs = sampleDocuments();
  const job = jobs.find((item) => item.id === jobId) ?? jobs[0];
  const draft = sampleDraft(job);

  return call<ExtractionResult>(
    "extract_document",
    { jobId },
    {
      job: { ...job, status: "review", confidence: draft.confidence, draft },
      draft
    }
  );
}

export async function loadDocumentDraft(jobId: string) {
  const job = sampleDocuments().find((item) => item.id === jobId);

  return call<ExtractionDraft | null>("document_draft", { jobId }, job?.draft ?? null);
}

export async function enqueueSampleDocuments() {
  return call<QueueJob[]>("enqueue_sample_documents", undefined, sampleDocuments());
}

function previewImportResult(path: string): ImportResult {
  const jobs = sampleDocuments();

  return {
    folder: {
      path,
      documentCount: jobs.length,
      newDocuments: jobs.length,
      duplicateDocuments: 0,
      skippedDocuments: 0
    },
    jobs
  };
}

function previewJob(jobId: string): QueueJob {
  return sampleDocuments().find((item) => item.id === jobId) ?? sampleDocuments()[0];
}

export async function updateDraftField(jobId: string, fieldName: string, value: string) {
  const job = previewJob(jobId);
  const fallback: QueueJob = job.draft
    ? {
        ...job,
        draft: {
          ...job.draft,
          fields: job.draft.fields.map((field) =>
            field.name === fieldName ? { ...field, value, needsReview: false } : field
          )
        }
      }
    : job;

  return call<QueueJob>("update_draft_field", { jobId, fieldName, value }, fallback);
}

export async function approveJob(jobId: string) {
  return call<QueueJob>("approve_job", { jobId }, { ...previewJob(jobId), status: "approved" });
}

export async function rejectJob(jobId: string, reason: string) {
  return call<QueueJob>("reject_job", { jobId, reason }, { ...previewJob(jobId), status: "rejected" });
}

function sampleDraft(job: QueueJob): ExtractionDraft {
  return {
    schemaId: job.kind === "intake" ? "erp.intake-form.default" : job.kind === "invoice" ? "erp.invoice.default" : "erp.support-evidence.default",
    targetType: job.kind === "intake" ? "intake-form" : job.kind === "invoice" ? "invoice" : "support-evidence",
    fields: [
      {
        name: "documentTitle",
        value: job.name,
        confidence: 0.82,
        source: { page: 1, text: job.name },
        needsReview: true
      },
      {
        name: "total",
        value: "$1,240.00",
        confidence: 0.78,
        source: { page: 1, text: "Total $1,240.00" },
        needsReview: true
      }
    ],
    tables: [],
    rawText: `${job.name}\nTotal $1,240.00`,
    summary: "Browser preview extraction draft. Desktop mode reads the document with the local Gemma vision model.",
    confidence: 0.8,
    runtime: "sidecar",
    model: "gemma4:e4b",
    warnings: ["Preview data only; run in Tauri desktop mode for local OCR."]
  };
}

function sampleRuntimeSettings(): RuntimeSettings {
  return {
    gemmaModel: "gemma4:e4b",
    ocrLanguage: "eng",
    suggestedModels: ["gemma4:e2b", "gemma4:e4b", "gemma4:12b", "gemma4:26b", "gemma4:31b"],
    installedModels: ["gemma4:e4b"],
    selectedModelInstalled: true,
    ollamaInstalled: true
  };
}

function sampleDocuments(): QueueJob[] {
  return [
    {
      id: "job_101",
      name: "vendor-invoice-0426.pdf",
      kind: "invoice",
      status: "review",
      confidence: 0.91,
      pages: 2,
      fileHash: "sample_invoice",
      path: "~/Documents/client-imports/vendor-invoice-0426.pdf",
      importedAt: 0,
      draft: null
    },
    {
      id: "job_102",
      name: "new-client-intake.jpg",
      kind: "intake",
      status: "ready",
      confidence: 0.84,
      pages: 1,
      fileHash: "sample_intake",
      path: "~/Documents/client-imports/new-client-intake.jpg",
      importedAt: 0,
      draft: null
    },
    {
      id: "job_103",
      name: "repair-receipt.png",
      kind: "support",
      status: "extracting",
      confidence: 0.72,
      pages: 1,
      fileHash: "sample_repair",
      path: "~/Documents/client-imports/repair-receipt.png",
      importedAt: 0,
      draft: null
    },
    {
      id: "job_104",
      name: "deposit-statement.pdf",
      kind: "invoice",
      status: "synced",
      confidence: 0.96,
      pages: 3,
      fileHash: "sample_statement",
      path: "~/Documents/client-imports/deposit-statement.pdf",
      importedAt: 0,
      draft: null
    }
  ].map((job) => (job.status === "review" || job.status === "synced" ? { ...job, draft: sampleDraft(job) } : job));
}
