import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export type RuntimeStatus = {
  ocr: "ready" | "missing" | "checking";
  llm: "ready" | "missing" | "checking";
  model: string;
  mode: "browser-preview" | "tauri";
};

export type SyncStatus = {
  baseUrl: string;
  state: "connected" | "not-configured" | "offline";
  pendingDrafts: number;
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
  status: "ready" | "extracting" | "review" | "synced";
  confidence: number;
  pages: number;
  fileHash: string;
  path: string;
  importedAt: number;
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
    llm: "missing",
    model: "Gemma local adapter pending",
    mode: "browser-preview"
  });
}

export async function getSyncStatus() {
  return call<SyncStatus>("sync_status", undefined, {
    baseUrl: "http://localhost:5174",
    state: "not-configured",
    pendingDrafts: 3
  });
}

export async function selectImportFolder() {
  const jobs = sampleDocuments();

  return call<ImportResult | null>("select_import_folder", undefined, {
    folder: {
      path: "~/Documents/client-imports",
      documentCount: jobs.length,
      newDocuments: jobs.length,
      duplicateDocuments: 0,
      skippedDocuments: 0
    },
    jobs
  });
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

export async function enqueueSampleDocuments() {
  return call<QueueJob[]>("enqueue_sample_documents", undefined, sampleDocuments());
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
      importedAt: 0
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
      importedAt: 0
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
      importedAt: 0
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
      importedAt: 0
    }
  ];
}
