export interface VideoGenerationConfig {
  enabled: boolean;
  defaultProvider?: string;
  maxPromptLength?: number;
  defaultExpiryDays?: number;
}

export type VideoGenerationIdPrefix = "vjob" | "vout";
export type VideoGenerationIdFactory = (prefix: VideoGenerationIdPrefix) => string;

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export type VideoJobStatus = "draft" | "submitted" | "processing" | "completed" | "failed" | "cancelled";
export type VideoResolution = "480p" | "720p" | "1080p" | "4k";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9";

export interface VideoReferenceAsset {
  path: string;
  mimeType: string;
  sizeBytes: number;
  role: "reference" | "image-to-video" | "mask";
}

export interface VideoGenerationJob {
  id: string;
  tenantId: string;
  ownerId: string | null;
  provider: string;
  providerTaskId: string | null;
  model: string | null;
  prompt: string;
  negativePrompt: string | null;
  status: VideoJobStatus;
  durationSeconds: number;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
  seed: number | null;
  referenceAssets: VideoReferenceAsset[];
  progress: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
}

export interface VideoGenerationOutput {
  id: string;
  tenantId: string;
  jobId: string;
  storageKey: string | null;
  publicUrl: string | null;
  providerUrl: string | null;
  mimeType: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface VideoGenerationSnapshot {
  job: VideoGenerationJob;
  outputs: VideoGenerationOutput[];
}

export interface CreateVideoJobInput {
  prompt: string;
  ownerId?: string | null;
  provider?: string | null;
  model?: string | null;
  negativePrompt?: string | null;
  durationSeconds?: number;
  resolution?: VideoResolution;
  aspectRatio?: VideoAspectRatio;
  seed?: number | null;
  referenceAssets?: VideoReferenceAsset[];
  metadata?: Record<string, unknown>;
}

export interface SubmitVideoJobInput {
  jobId: string;
}

export interface RecordVideoProviderStatusInput {
  jobId?: string;
  providerTaskId?: string;
  status: Extract<VideoJobStatus, "submitted" | "processing" | "completed" | "failed">;
  progress?: number | null;
  errorMessage?: string | null;
  providerUrls?: string[];
}

export interface AttachVideoOutputInput {
  jobId: string;
  storageKey?: string | null;
  publicUrl?: string | null;
  providerUrl?: string | null;
  mimeType?: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  expiresAt?: string | null;
}

export interface CancelVideoJobInput {
  jobId: string;
  reason?: string | null;
}

export interface ListVideoJobsInput {
  ownerId?: string | null;
  status?: VideoJobStatus;
  limit?: number;
}

export interface VideoProviderSubmitResult {
  providerTaskId: string;
  raw?: Record<string, unknown>;
}

export interface VideoGenerationProvider {
  submitVideoJob(job: VideoGenerationJob): Promise<VideoProviderSubmitResult>;
}

export type VideoGenerationRecord = VideoGenerationJob | VideoGenerationOutput;

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
