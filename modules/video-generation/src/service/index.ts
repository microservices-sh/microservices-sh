import type { VideoGenerationStore } from "../ports";
import type {
  AttachVideoOutputInput,
  CancelVideoJobInput,
  CreateVideoJobInput,
  ListVideoJobsInput,
  ModuleResult,
  RecordVideoProviderStatusInput,
  SubmitVideoJobInput,
  TenantContext,
  VideoAspectRatio,
  VideoGenerationConfig,
  VideoGenerationIdFactory,
  VideoGenerationIdPrefix,
  VideoGenerationJob,
  VideoGenerationOutput,
  VideoGenerationProvider,
  VideoGenerationSnapshot,
  VideoJobStatus,
  VideoReferenceAsset,
  VideoResolution
} from "../types";

const ASPECT_RATIOS = new Set<VideoAspectRatio>(["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"]);
const RESOLUTIONS = new Set<VideoResolution>(["480p", "720p", "1080p", "4k"]);

export interface VideoGenerationServiceDeps {
  store: VideoGenerationStore;
  provider?: VideoGenerationProvider;
  createId?: VideoGenerationIdFactory;
  config?: VideoGenerationConfig;
}

export interface VideoGenerationService {
  createVideoJob(ctx: TenantContext, input: CreateVideoJobInput): Promise<ModuleResult<VideoGenerationSnapshot>>;
  submitVideoJob(ctx: TenantContext, input: SubmitVideoJobInput): Promise<ModuleResult<VideoGenerationSnapshot>>;
  recordVideoProviderStatus(ctx: TenantContext, input: RecordVideoProviderStatusInput): Promise<ModuleResult<VideoGenerationSnapshot>>;
  attachVideoOutput(ctx: TenantContext, input: AttachVideoOutputInput): Promise<ModuleResult<VideoGenerationOutput>>;
  cancelVideoJob(ctx: TenantContext, input: CancelVideoJobInput): Promise<ModuleResult<VideoGenerationJob>>;
  getVideoJob(ctx: TenantContext, jobId: string): Promise<ModuleResult<VideoGenerationSnapshot>>;
  listVideoJobs(ctx: TenantContext, input?: ListVideoJobsInput): Promise<ModuleResult<VideoGenerationJob[]>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialVideoGenerationIdFactory(): VideoGenerationIdFactory {
  let sequence = 0;
  return (prefix: VideoGenerationIdPrefix) => id(prefix, ++sequence);
}

function defaultId(prefix: VideoGenerationIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeObject(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function clampProgress(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function validateReferenceAssets(assets: VideoReferenceAsset[] | undefined): ModuleResult<VideoReferenceAsset[]> {
  const cleaned: VideoReferenceAsset[] = [];
  for (const asset of assets ?? []) {
    const path = cleanText(asset.path);
    const mimeType = cleanText(asset.mimeType) ?? "application/octet-stream";
    if (!path || path.includes("..")) return fail("reference_asset_path_invalid", "Reference asset path is required and cannot contain parent traversal.");
    if (!Number.isInteger(asset.sizeBytes) || asset.sizeBytes < 0) return fail("reference_asset_size_invalid", "Reference asset size must be a non-negative integer.");
    cleaned.push({
      path,
      mimeType,
      sizeBytes: asset.sizeBytes,
      role: asset.role
    });
  }
  return ok(cleaned);
}

async function snapshot(store: VideoGenerationStore, tenantId: string, job: VideoGenerationJob): Promise<VideoGenerationSnapshot> {
  return {
    job,
    outputs: await store.listOutputsForJob(tenantId, job.id)
  };
}

function isTerminal(status: VideoJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function createVideoGenerationService(deps: VideoGenerationServiceDeps): VideoGenerationService {
  const createId = deps.createId ?? defaultId;
  const defaultProvider = deps.config?.defaultProvider ?? "provider";
  const maxPromptLength = deps.config?.maxPromptLength ?? 4000;
  const defaultExpiryDays = deps.config?.defaultExpiryDays ?? 7;

  return {
    async createVideoJob(ctx, input) {
      const prompt = cleanText(input.prompt);
      if (!prompt) return fail("prompt_required", "Prompt is required.");
      if (prompt.length > maxPromptLength) return fail("prompt_too_long", "Prompt exceeds the configured length limit.");
      const durationSeconds = input.durationSeconds ?? 8;
      if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 120) return fail("duration_invalid", "Duration must be an integer between 1 and 120 seconds.");
      const resolution = input.resolution ?? "720p";
      if (!RESOLUTIONS.has(resolution)) return fail("resolution_invalid", "Resolution is not supported.");
      const aspectRatio = input.aspectRatio ?? "16:9";
      if (!ASPECT_RATIOS.has(aspectRatio)) return fail("aspect_ratio_invalid", "Aspect ratio is not supported.");
      const references = validateReferenceAssets(input.referenceAssets);
      if (!references.ok || !references.data) return fail("reference_assets_invalid", references.error?.message ?? "Reference assets are invalid.");

      const timestamp = now(ctx);
      const job: VideoGenerationJob = {
        id: createId("vjob"),
        tenantId: ctx.tenantId,
        ownerId: cleanText(input.ownerId),
        provider: cleanText(input.provider) ?? defaultProvider,
        providerTaskId: null,
        model: cleanText(input.model),
        prompt,
        negativePrompt: cleanText(input.negativePrompt),
        status: "draft",
        durationSeconds,
        resolution,
        aspectRatio,
        seed: input.seed ?? null,
        referenceAssets: references.data,
        progress: null,
        errorMessage: null,
        metadata: safeObject(input.metadata),
        createdBy: cleanText(ctx.actorId),
        createdAt: timestamp,
        updatedAt: timestamp,
        submittedAt: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null
      };
      await deps.store.upsertJob(job);
      return ok(await snapshot(deps.store, ctx.tenantId, job));
    },

    async submitVideoJob(ctx, input) {
      if (!deps.provider) return fail("provider_missing", "A video generation provider port is required to submit jobs.");
      const job = await deps.store.getJob(ctx.tenantId, input.jobId);
      if (!job) return fail("job_not_found", "Video generation job was not found.");
      if (isTerminal(job.status)) return fail("job_terminal", "Terminal jobs cannot be submitted.");
      if (job.providerTaskId) return ok(await snapshot(deps.store, ctx.tenantId, job));
      const timestamp = now(ctx);
      const submittedBase: VideoGenerationJob = {
        ...job,
        status: "submitted",
        updatedAt: timestamp,
        submittedAt: timestamp,
        progress: 0
      };
      const result = await deps.provider.submitVideoJob(submittedBase);
      const submitted: VideoGenerationJob = {
        ...submittedBase,
        providerTaskId: result.providerTaskId,
        metadata: { ...submittedBase.metadata, providerSubmit: result.raw ?? null }
      };
      await deps.store.upsertJob(submitted);
      return ok(await snapshot(deps.store, ctx.tenantId, submitted));
    },

    async recordVideoProviderStatus(ctx, input) {
      const job = input.jobId
        ? await deps.store.getJob(ctx.tenantId, input.jobId)
        : input.providerTaskId
          ? await deps.store.getJobByProviderTaskId(ctx.tenantId, input.providerTaskId)
          : null;
      if (!job) return fail("job_not_found", "Video generation job was not found.");
      if (job.status === "cancelled") return fail("job_cancelled", "Cancelled jobs cannot be reconciled.");
      const timestamp = now(ctx);
      const status = input.status;
      const updated: VideoGenerationJob = {
        ...job,
        status,
        progress: status === "completed" ? 100 : clampProgress(input.progress),
        errorMessage: cleanText(input.errorMessage),
        updatedAt: timestamp,
        completedAt: status === "completed" ? timestamp : job.completedAt,
        failedAt: status === "failed" ? timestamp : job.failedAt
      };
      await deps.store.upsertJob(updated);

      for (const providerUrl of input.providerUrls ?? []) {
        const cleanedUrl = cleanText(providerUrl);
        if (!cleanedUrl) continue;
        if (await deps.store.getOutputByProviderUrl(ctx.tenantId, updated.id, cleanedUrl)) continue;
        const output: VideoGenerationOutput = {
          id: createId("vout"),
          tenantId: ctx.tenantId,
          jobId: updated.id,
          storageKey: null,
          publicUrl: null,
          providerUrl: cleanedUrl,
          mimeType: "video/mp4",
          sizeBytes: null,
          width: null,
          height: null,
          durationSeconds: updated.durationSeconds,
          expiresAt: addDays(timestamp, defaultExpiryDays),
          createdAt: timestamp
        };
        await deps.store.insertOutput(output);
      }

      return ok(await snapshot(deps.store, ctx.tenantId, updated));
    },

    async attachVideoOutput(ctx, input) {
      const job = await deps.store.getJob(ctx.tenantId, input.jobId);
      if (!job) return fail("job_not_found", "Video generation job was not found.");
      if (!cleanText(input.storageKey) && !cleanText(input.publicUrl) && !cleanText(input.providerUrl)) return fail("output_location_required", "At least one output location is required.");
      const output: VideoGenerationOutput = {
        id: createId("vout"),
        tenantId: ctx.tenantId,
        jobId: job.id,
        storageKey: cleanText(input.storageKey),
        publicUrl: cleanText(input.publicUrl),
        providerUrl: cleanText(input.providerUrl),
        mimeType: cleanText(input.mimeType) ?? "video/mp4",
        sizeBytes: input.sizeBytes ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        durationSeconds: input.durationSeconds ?? job.durationSeconds,
        expiresAt: input.expiresAt === undefined ? addDays(now(ctx), defaultExpiryDays) : cleanText(input.expiresAt),
        createdAt: now(ctx)
      };
      await deps.store.insertOutput(output);
      return ok(output);
    },

    async cancelVideoJob(ctx, input) {
      const job = await deps.store.getJob(ctx.tenantId, input.jobId);
      if (!job) return fail("job_not_found", "Video generation job was not found.");
      if (isTerminal(job.status)) return fail("job_terminal", "Terminal jobs cannot be cancelled.");
      const timestamp = now(ctx);
      const cancelled: VideoGenerationJob = {
        ...job,
        status: "cancelled",
        errorMessage: cleanText(input.reason),
        updatedAt: timestamp,
        cancelledAt: timestamp
      };
      await deps.store.upsertJob(cancelled);
      return ok(cancelled);
    },

    async getVideoJob(ctx, jobId) {
      const job = await deps.store.getJob(ctx.tenantId, jobId);
      if (!job) return fail("job_not_found", "Video generation job was not found.");
      return ok(await snapshot(deps.store, ctx.tenantId, job));
    },

    async listVideoJobs(ctx, input = {}) {
      return ok(await deps.store.listJobs(ctx.tenantId, input));
    }
  };
}

export function getVideoGenerationModuleStatus() {
  return { id: "video-generation", status: "draft" } as const;
}
