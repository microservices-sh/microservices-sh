import type { CodeMemoryStore } from "../ports";
import type {
  AddTrustedSourceInput,
  CapsuleApprovalStatus,
  CapsuleReuseMode,
  CapsuleVisibility,
  CodeMemoryEvent,
  CodeMemoryIdFactory,
  CodeMemoryIdPrefix,
  CodeMemoryConfig,
  CreateLogicCapsuleInput,
  LogicCapsule,
  ModuleResult,
  RecordSourceScanInput,
  RecordSourceScanResult,
  RepoVisibility,
  SearchLogicCapsulesInput,
  SourceScanStatus,
  SourceVersion,
  TenantContext,
  TrustedSource,
  TrustedSourceProvider,
  UpdateCapsuleApprovalInput
} from "../types";

export interface CodeMemoryServiceDeps {
  store: CodeMemoryStore;
  createId?: CodeMemoryIdFactory;
  config?: CodeMemoryConfig;
}

export interface CodeMemoryService {
  addTrustedSource(ctx: TenantContext, input: AddTrustedSourceInput): Promise<ModuleResult<{ source: TrustedSource }>>;
  listTrustedSources(ctx: TenantContext, limit?: number): Promise<ModuleResult<{ sources: TrustedSource[] }>>;
  recordSourceScan(ctx: TenantContext, input: RecordSourceScanInput): Promise<ModuleResult<RecordSourceScanResult>>;
  createLogicCapsule(ctx: TenantContext, input: CreateLogicCapsuleInput): Promise<ModuleResult<{ capsule: LogicCapsule }>>;
  searchLogicCapsules(ctx: TenantContext, input?: SearchLogicCapsulesInput): Promise<ModuleResult<{ capsules: LogicCapsule[] }>>;
  getLogicCapsule(ctx: TenantContext, idOrSlug: string): Promise<ModuleResult<{ capsule: LogicCapsule }>>;
  approveLogicCapsule(ctx: TenantContext, idOrSlug: string): Promise<ModuleResult<{ capsule: LogicCapsule }>>;
  rejectLogicCapsule(ctx: TenantContext, idOrSlug: string): Promise<ModuleResult<{ capsule: LogicCapsule }>>;
}

const REUSE_MODES = new Set<CapsuleReuseMode>(["reference", "copy", "adapt", "module", "test-only"]);
const APPROVAL_STATUSES = new Set<CapsuleApprovalStatus>(["candidate", "approved", "rejected", "archived"]);
const CAPSULE_VISIBILITIES = new Set<CapsuleVisibility>(["workspace_private", "shared", "unlisted", "public_candidate"]);
const REPO_VISIBILITIES = new Set<RepoVisibility>(["public", "private", "unknown"]);

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

export function createSequentialCodeMemoryIdFactory(): CodeMemoryIdFactory {
  const sequences: Record<CodeMemoryIdPrefix, number> = { cmsrc: 0, cmver: 0, cmcap: 0, cmevt: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: CodeMemoryIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanPath(value: string | null | undefined): string | null {
  const trimmed = cleanText(value);
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized.includes("..")) return null;
  return normalized;
}

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(cleanText).filter((value): value is string => Boolean(value)))];
}

function slugFrom(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validateSlug(value: string): ModuleResult<string> {
  const slug = slugFrom(value);
  if (slug.length < 3) return fail("slug_invalid", "Logic Capsule slug must contain at least 3 URL-safe characters.");
  return ok(slug);
}

function normalizeRepoVisibility(value: RepoVisibility | undefined): RepoVisibility {
  return value && REPO_VISIBILITIES.has(value) ? value : "unknown";
}

function normalizeReuseMode(value: CapsuleReuseMode | null | undefined): CapsuleReuseMode {
  return value && REUSE_MODES.has(value) ? value : "adapt";
}

function normalizeApprovalStatus(value: CapsuleApprovalStatus | undefined): CapsuleApprovalStatus {
  return value && APPROVAL_STATUSES.has(value) ? value : "candidate";
}

function normalizeCapsuleVisibility(value: CapsuleVisibility | undefined): CapsuleVisibility {
  return value && CAPSULE_VISIBILITIES.has(value) ? value : "workspace_private";
}

function normalizeScanStatus(value: SourceScanStatus | undefined): SourceScanStatus {
  return value && ["not_scanned", "pending", "scanned", "failed"].includes(value) ? value : "scanned";
}

interface ParsedSourceUrl {
  provider: TrustedSourceProvider;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  ref: string | null;
  path: string | null;
}

function parseSourceUrl(repoUrl: string): ModuleResult<ParsedSourceUrl> {
  const trimmed = cleanText(repoUrl);
  if (!trimmed) return fail("repo_url_required", "Trusted Source repo URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fail("repo_url_invalid", "Trusted Source repo URL must be a valid URL.");
  }
  if (parsed.hostname !== "github.com") return fail("repo_provider_unsupported", "Only github.com Trusted Sources are supported in this MVP.");
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return fail("repo_url_invalid", "GitHub URL must include owner and repo.");
  const repoName = parts[1]?.replace(/\.git$/, "");
  if (!parts[0] || !repoName) return fail("repo_url_invalid", "GitHub URL must include owner and repo.");
  const treeIndex = parts.indexOf("tree");
  const ref = treeIndex >= 0 ? parts[treeIndex + 1] ?? null : null;
  const path = treeIndex >= 0 ? cleanPath(parts.slice(treeIndex + 2).join("/")) : null;
  return ok({
    provider: "github",
    repoUrl: `https://github.com/${parts[0]}/${repoName}`,
    repoOwner: parts[0],
    repoName,
    ref,
    path
  });
}

function validLimit(limit: number | undefined, fallback: number, max: number): number | null {
  if (limit == null) return fallback;
  if (!Number.isInteger(limit) || limit < 1 || limit > max) return null;
  return limit;
}

export function createCodeMemoryService(deps: CodeMemoryServiceDeps): CodeMemoryService {
  const createId = deps.createId ?? defaultId;
  const maxAllowedPaths = deps.config?.maxAllowedPaths ?? 10;

  async function recordEvent(ctx: TenantContext, action: string, targetType: CodeMemoryEvent["targetType"], targetId: string, metadata: Record<string, unknown> = {}) {
    await deps.store.insertEvent({
      id: createId("cmevt"),
      tenantId: ctx.tenantId,
      actorUserId: ctx.actorId ?? null,
      action,
      targetType,
      targetId,
      metadata,
      createdAt: now(ctx)
    });
  }

  async function createCapsule(ctx: TenantContext, input: CreateLogicCapsuleInput, source: TrustedSource, sourceVersion: SourceVersion | null): Promise<ModuleResult<LogicCapsule>> {
    const name = cleanText(input.name);
    const purpose = cleanText(input.purpose);
    if (!name) return fail("capsule_name_required", "Logic Capsule name is required.");
    if (!purpose) return fail("capsule_purpose_required", "Logic Capsule purpose is required.");
    const slug = validateSlug(input.slug ?? name);
    if (!slug.ok || !slug.data) return fail(slug.error?.code ?? "slug_invalid", slug.error?.message ?? "Logic Capsule slug is invalid.");
    const timestamp = now(ctx);
    const sourcePath = cleanPath(input.sourcePath) ?? cleanPath(input.files?.[0]) ?? null;
    const capsule: LogicCapsule = {
      id: createId("cmcap"),
      tenantId: ctx.tenantId,
      sourceId: source.id,
      sourceVersionId: input.sourceVersionId ?? sourceVersion?.id ?? null,
      slug: slug.data,
      name,
      purpose,
      reuseMode: normalizeReuseMode(input.reuseMode),
      sourcePath,
      files: cleanList(input.files ?? (sourcePath ? [sourcePath] : [])),
      tests: cleanList(input.tests),
      dependencies: cleanList(input.dependencies),
      requiredEnv: cleanList(input.requiredEnv),
      inputs: cleanList(input.inputs),
      outputs: cleanList(input.outputs),
      usageNotes: cleanText(input.usageNotes),
      constraints: cleanList(input.constraints),
      doNotUseFor: cleanList(input.doNotUseFor),
      checksum: cleanText(input.checksum),
      approvalStatus: normalizeApprovalStatus(input.approvalStatus),
      visibility: normalizeCapsuleVisibility(input.visibility),
      provenance: {
        repoUrl: source.repoUrl,
        repoOwner: source.repoOwner,
        repoName: source.repoName,
        path: sourcePath ?? undefined,
        ref: sourceVersion?.ref ?? source.defaultBranch ?? undefined,
        commitSha: sourceVersion?.commitSha ?? undefined
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await deps.store.insertCapsule(capsule);
    await recordEvent(ctx, "code-memory.capsule.created", "capsule", capsule.id, { slug: capsule.slug, status: capsule.approvalStatus });
    return ok(capsule);
  }

  async function updateApproval(ctx: TenantContext, input: UpdateCapsuleApprovalInput): Promise<ModuleResult<{ capsule: LogicCapsule }>> {
    const idOrSlug = cleanText(input.idOrSlug);
    if (!idOrSlug) return fail("capsule_id_required", "Logic Capsule id or slug is required.");
    const capsule = await deps.store.getCapsuleByIdOrSlug(ctx.tenantId, idOrSlug);
    if (!capsule) return fail("capsule_not_found", "Logic Capsule was not found.");
    const updated = { ...capsule, approvalStatus: input.approvalStatus, updatedAt: now(ctx) };
    await deps.store.updateCapsule(updated);
    await recordEvent(ctx, `code-memory.capsule.${input.approvalStatus}`, "capsule", updated.id, { slug: updated.slug });
    return ok({ capsule: updated });
  }

  return {
    async addTrustedSource(ctx, input) {
      const parsed = parseSourceUrl(input.repoUrl);
      if (!parsed.ok || !parsed.data) return fail(parsed.error?.code ?? "repo_url_invalid", parsed.error?.message ?? "Trusted Source repo URL is invalid.");
      const allowedPath = cleanPath(input.path) ?? parsed.data.path;
      const allowedPaths = allowedPath ? [allowedPath] : [];
      if (allowedPaths.length > maxAllowedPaths) return fail("too_many_allowed_paths", `Trusted Source may declare at most ${maxAllowedPaths} allowed paths.`);
      const ref = cleanText(input.ref) ?? parsed.data.ref;
      const timestamp = now(ctx);
      const source: TrustedSource = {
        id: createId("cmsrc"),
        tenantId: ctx.tenantId,
        ownerUserId: cleanText(input.ownerUserId) ?? ctx.actorId ?? null,
        provider: parsed.data.provider,
        repoUrl: parsed.data.repoUrl,
        repoOwner: parsed.data.repoOwner,
        repoName: parsed.data.repoName,
        repoVisibility: normalizeRepoVisibility(input.repoVisibility),
        defaultBranch: cleanText(input.defaultBranch) ?? ref ?? "main",
        allowedPaths,
        installationId: cleanText(input.installationId),
        scanStatus: "not_scanned",
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.insertSource(source);
      await recordEvent(ctx, "code-memory.source.added", "source", source.id, { repoUrl: source.repoUrl, allowedPaths });
      return ok({ source });
    },

    async listTrustedSources(ctx, limit = 50) {
      const safeLimit = validLimit(limit, 50, 100);
      if (safeLimit == null) return fail("limit_invalid", "Limit must be an integer between 1 and 100.");
      return ok({ sources: await deps.store.listSources(ctx.tenantId, safeLimit) });
    },

    async recordSourceScan(ctx, input) {
      const sourceId = cleanText(input.sourceId);
      if (!sourceId) return fail("source_id_required", "Trusted Source id is required.");
      const source = await deps.store.getSource(ctx.tenantId, sourceId);
      if (!source) return fail("source_not_found", "Trusted Source was not found.");
      const timestamp = now(ctx);
      const status = normalizeScanStatus(input.scanStatus);
      const version: SourceVersion = {
        id: createId("cmver"),
        tenantId: ctx.tenantId,
        sourceId: source.id,
        ref: cleanText(input.ref) ?? source.defaultBranch ?? "main",
        commitSha: cleanText(input.commitSha),
        treeChecksum: cleanText(input.treeChecksum),
        scanStatus: status,
        scanSummary: input.scanSummary ?? {},
        createdAt: timestamp
      };
      await deps.store.insertSourceVersion(version);
      const updatedSource = await deps.store.updateSourceScanStatus(ctx.tenantId, source.id, status, timestamp);
      const candidates: LogicCapsule[] = [];
      for (const candidate of input.candidates ?? []) {
        const created = await createCapsule(ctx, { ...candidate, sourceId: source.id, sourceVersionId: version.id, approvalStatus: "candidate" }, updatedSource ?? source, version);
        if (created.ok && created.data) candidates.push(created.data);
      }
      await recordEvent(ctx, "code-memory.source.scanned", "source_version", version.id, { sourceId: source.id, status, candidateCount: candidates.length });
      return ok({
        source: updatedSource ?? source,
        sourceVersion: version,
        candidates,
        scanned: {
          ref: version.ref,
          fileCount: Number(input.scanSummary?.fileCount ?? 0),
          candidateCount: candidates.length,
          truncated: Boolean(input.scanSummary?.truncated)
        },
        nextSteps: ["Review candidate Logic Capsules before approving them for agent reuse."]
      });
    },

    async createLogicCapsule(ctx, input) {
      const sourceId = cleanText(input.sourceId);
      if (!sourceId) return fail("source_id_required", "Trusted Source id is required.");
      const source = await deps.store.getSource(ctx.tenantId, sourceId);
      if (!source) return fail("source_not_found", "Trusted Source was not found.");
      const version = input.sourceVersionId ? null : await deps.store.getLatestSourceVersion(ctx.tenantId, source.id);
      const capsule = await createCapsule(ctx, input, source, version);
      return capsule.ok && capsule.data ? ok({ capsule: capsule.data }) : fail(capsule.error?.code ?? "capsule_invalid", capsule.error?.message ?? "Logic Capsule input is invalid.");
    },

    async searchLogicCapsules(ctx, input = {}) {
      const limit = validLimit(input.limit, 25, 100);
      if (limit == null) return fail("limit_invalid", "Limit must be an integer between 1 and 100.");
      return ok({ capsules: await deps.store.searchCapsules(ctx.tenantId, { ...input, limit, approvalStatus: input.approvalStatus ?? "approved" }) });
    },

    async getLogicCapsule(ctx, idOrSlug) {
      const key = cleanText(idOrSlug);
      if (!key) return fail("capsule_id_required", "Logic Capsule id or slug is required.");
      const capsule = await deps.store.getCapsuleByIdOrSlug(ctx.tenantId, key);
      if (!capsule) return fail("capsule_not_found", "Logic Capsule was not found.");
      await recordEvent(ctx, "code-memory.capsule.retrieved", "capsule", capsule.id, { slug: capsule.slug });
      return ok({ capsule });
    },

    approveLogicCapsule(ctx, idOrSlug) {
      return updateApproval(ctx, { idOrSlug, approvalStatus: "approved" });
    },

    rejectLogicCapsule(ctx, idOrSlug) {
      return updateApproval(ctx, { idOrSlug, approvalStatus: "rejected" });
    }
  };
}
