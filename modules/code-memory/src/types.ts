export interface CodeMemoryConfig {
  enabled?: boolean;
  defaultProvider?: TrustedSourceProvider;
  maxAllowedPaths?: number;
}

export type CodeMemoryIdPrefix = "cmsrc" | "cmver" | "cmcap" | "cmevt";
export type CodeMemoryIdFactory = (prefix: CodeMemoryIdPrefix) => string;

export type TrustedSourceProvider = "github" | "gitlab" | "local-upload";
export type RepoVisibility = "public" | "private" | "unknown";
export type SourceScanStatus = "not_scanned" | "pending" | "scanned" | "failed";
export type CapsuleApprovalStatus = "candidate" | "approved" | "rejected" | "archived";
export type CapsuleVisibility = "workspace_private" | "shared" | "unlisted" | "public_candidate";
export type CapsuleReuseMode = "reference" | "copy" | "adapt" | "module" | "test-only";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface TrustedSource {
  id: string;
  tenantId: string;
  ownerUserId: string | null;
  provider: TrustedSourceProvider;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  repoVisibility: RepoVisibility;
  defaultBranch: string | null;
  allowedPaths: string[];
  installationId: string | null;
  scanStatus: SourceScanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SourceVersion {
  id: string;
  tenantId: string;
  sourceId: string;
  ref: string;
  commitSha: string | null;
  treeChecksum: string | null;
  scanStatus: SourceScanStatus;
  scanSummary: Record<string, unknown>;
  createdAt: string;
}

export interface CapsuleProvenance {
  repoUrl?: string;
  repoOwner?: string;
  repoName?: string;
  path?: string;
  ref?: string;
  commitSha?: string;
}

export interface LogicCapsule {
  id: string;
  tenantId: string;
  sourceId: string;
  sourceVersionId: string | null;
  slug: string;
  name: string;
  purpose: string;
  reuseMode: CapsuleReuseMode;
  sourcePath: string | null;
  files: string[];
  tests: string[];
  dependencies: string[];
  requiredEnv: string[];
  inputs: string[];
  outputs: string[];
  usageNotes: string | null;
  constraints: string[];
  doNotUseFor: string[];
  checksum: string | null;
  approvalStatus: CapsuleApprovalStatus;
  visibility: CapsuleVisibility;
  provenance: CapsuleProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface CodeMemoryEvent {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  action: string;
  targetType: "source" | "source_version" | "capsule";
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AddTrustedSourceInput {
  repoUrl: string;
  repoVisibility?: RepoVisibility;
  path?: string | null;
  ref?: string | null;
  defaultBranch?: string | null;
  ownerUserId?: string | null;
  installationId?: string | null;
}

export interface RecordSourceScanInput {
  sourceId: string;
  ref?: string | null;
  commitSha?: string | null;
  treeChecksum?: string | null;
  scanStatus?: SourceScanStatus;
  scanSummary?: Record<string, unknown>;
  candidates?: CreateLogicCapsuleInput[];
}

export interface RecordSourceScanResult {
  source: TrustedSource;
  sourceVersion: SourceVersion;
  candidates: LogicCapsule[];
  scanned: {
    ref: string;
    fileCount: number;
    candidateCount: number;
    truncated: boolean;
  };
  nextSteps: string[];
}

export interface SourceFileHint {
  path: string;
  sizeBytes?: number | null;
  content?: string | null;
  exportedSymbols?: string[];
}

export interface SuggestLogicCapsulesInput {
  sourceId: string;
  ref?: string | null;
  commitSha?: string | null;
  treeChecksum?: string | null;
  files: SourceFileHint[];
  maxCandidates?: number;
}

export type SuggestedLogicCapsuleScanSummary = Record<string, unknown> & {
  fileCount: number;
  candidateCount: number;
  truncated: boolean;
  skippedFileCount: number;
  maxCandidates: number;
  heuristics: string[];
};

export interface SuggestLogicCapsulesResult {
  candidates: CreateLogicCapsuleInput[];
  scanSummary: SuggestedLogicCapsuleScanSummary;
}

export interface CreateLogicCapsuleInput {
  sourceId: string;
  sourceVersionId?: string | null;
  slug?: string | null;
  name: string;
  purpose: string;
  reuseMode?: CapsuleReuseMode | null;
  sourcePath?: string | null;
  files?: string[];
  tests?: string[];
  dependencies?: string[];
  requiredEnv?: string[];
  inputs?: string[];
  outputs?: string[];
  usageNotes?: string | null;
  constraints?: string[];
  doNotUseFor?: string[];
  checksum?: string | null;
  approvalStatus?: CapsuleApprovalStatus;
  visibility?: CapsuleVisibility;
}

export interface SearchLogicCapsulesInput {
  query?: string | null;
  approvalStatus?: CapsuleApprovalStatus | "any";
  limit?: number;
}

export interface UpdateCapsuleApprovalInput {
  idOrSlug: string;
  approvalStatus: Extract<CapsuleApprovalStatus, "approved" | "rejected" | "archived">;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
