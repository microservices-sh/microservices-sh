export type ExtractionMode = "local-only" | "gateway-only" | "hybrid" | "sidecar";
export type ExtractionRuntime = "browser-ocr" | "browser-local-llm" | "ai-gateway" | "sidecar";
export type ExtractionJobStatus = "pending" | "extracting" | "needs_review" | "approved" | "rejected" | "failed";
export type ExtractionTargetType = "invoice" | "receipt" | "intake-form" | "customer-document" | "support-evidence" | "custom";
export type ReviewDecision = "approve" | "reject";

export interface DocumentExtractionConfig {
  enabled: boolean;
  mode: ExtractionMode;
  reviewRequired: boolean;
  minConfidenceForApproval: number;
  localBrowser: {
    enabled: boolean;
    downloadOnDemand: boolean;
    maxPages: number;
  };
  gatewayFallback: {
    enabled: boolean;
    requiresApproval: boolean;
    minConfidence: number;
  };
  sidecar: {
    enabled: boolean;
    endpoint: string | null;
  };
}

export interface SourceRegion {
  page?: number;
  text?: string;
  boundingBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface ExtractedField {
  name: string;
  value: string | number | boolean | null;
  confidence: number;
  source?: SourceRegion;
  needsReview?: boolean;
}

export interface ExtractedTable {
  name: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  confidence: number;
  source?: SourceRegion;
}

export interface DocumentReference {
  fileId?: string;
  key?: string;
  mimeType: string;
  originalName?: string;
  bytes?: number;
  pageCount?: number;
  sha256?: string;
}

export interface ExtractionDraft {
  schemaId: string;
  targetType: ExtractionTargetType;
  fields: ExtractedField[];
  tables: ExtractedTable[];
  rawText?: string;
  summary?: string;
  confidence: number;
  runtime: ExtractionRuntime;
  model?: string;
  warnings: string[];
}

export interface ExtractionReview {
  decision: ReviewDecision;
  reviewerId: string;
  notes?: string;
  targetRecord?: {
    moduleId: string;
    recordId: string;
  };
  reviewedAt: string;
}

export interface DocumentExtractionJob {
  id: string;
  tenantId: string;
  ownerId: string | null;
  status: ExtractionJobStatus;
  targetType: ExtractionTargetType;
  schemaId: string;
  requestedMode: ExtractionMode;
  selectedRuntime: ExtractionRuntime | null;
  source: DocumentReference;
  draft: ExtractionDraft | null;
  approvedOutput: Record<string, unknown> | null;
  review: ExtractionReview | null;
  metadata: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentExtractionRecord = DocumentExtractionJob;

export interface DocumentExtractionStore {
  createJob(job: DocumentExtractionJob): Promise<DocumentExtractionJob>;
  getJob(input: { jobId: string; tenantId: string }): Promise<DocumentExtractionJob | null>;
  listJobs(filter: { tenantId: string; ownerId?: string | null; status?: ExtractionJobStatus; limit?: number }): Promise<DocumentExtractionJob[]>;
  updateJob(input: { jobId: string; tenantId: string; patch: Partial<DocumentExtractionJob> }): Promise<DocumentExtractionJob | null>;
}

export interface ExtractionNormalizerInput {
  tenantId: string;
  schemaId: string;
  targetType: ExtractionTargetType;
  runtime: ExtractionRuntime;
  rawText: string;
  documentName?: string;
  fieldsHint?: string[];
}

export interface ExtractionNormalizer {
  normalize(input: ExtractionNormalizerInput): Promise<ExtractionDraft>;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T; warnings?: string[] }
  | { ok: false; status: number; error: { code: string; message: string; details?: unknown } };
