import type { CodeMemoryService } from "./service";
import type {
  AddTrustedSourceInput,
  CapsuleApprovalStatus,
  CapsuleReuseMode,
  CreateLogicCapsuleInput,
  ModuleResult,
  RecordSourceScanInput,
  RepoVisibility,
  SearchLogicCapsulesInput,
  SourceScanStatus,
  TenantContext
} from "./types";

export interface CodeMemoryToolContext {
  tenantId?: string;
  actor?: string | null;
  actorId?: string | null;
  now?: string;
}

export interface CodeMemoryToolHandlerDeps {
  service: CodeMemoryService;
  defaultTenantId?: string;
}

export type CodeMemoryToolHandler = (input: Record<string, unknown>, ctx?: CodeMemoryToolContext) => Promise<unknown>;

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function tenantContext(ctx: CodeMemoryToolContext | undefined, defaultTenantId: string | undefined): TenantContext {
  const tenantId = optionalString(ctx?.tenantId) ?? optionalString(defaultTenantId);
  if (!tenantId) throw new Error("Code Memory tool context requires tenantId.");
  return {
    tenantId,
    actorId: optionalString(ctx?.actorId) ?? optionalString(ctx?.actor) ?? undefined,
    now: optionalString(ctx?.now) ?? undefined
  };
}

function idOrSlug(input: Record<string, unknown>): string {
  const value = optionalString(input.idOrSlug) ?? optionalString(input.id) ?? optionalString(input.slug);
  if (!value) throw new Error("Code Memory tool input requires idOrSlug.");
  return value;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.map(optionalString).filter((item): item is string => Boolean(item));
  return values.length ? values : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function repoVisibility(value: unknown): RepoVisibility | undefined {
  const normalized = optionalString(value);
  return normalized === "public" || normalized === "private" || normalized === "unknown" ? normalized : undefined;
}

function scanStatus(value: unknown): SourceScanStatus | undefined {
  const normalized = optionalString(value);
  return normalized === "not_scanned" || normalized === "pending" || normalized === "scanned" || normalized === "failed" ? normalized : undefined;
}

function approvalStatus(value: unknown): CapsuleApprovalStatus | undefined {
  const normalized = optionalString(value);
  return normalized === "candidate" || normalized === "approved" || normalized === "rejected" || normalized === "archived" ? normalized : undefined;
}

function reuseMode(value: unknown): CapsuleReuseMode | undefined {
  const normalized = optionalString(value);
  return normalized === "reference" || normalized === "copy" || normalized === "adapt" || normalized === "module" || normalized === "test-only" ? normalized : undefined;
}

function limit(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function trustedSourceInput(input: Record<string, unknown>): AddTrustedSourceInput {
  return {
    repoUrl: String(input.repoUrl ?? ""),
    repoVisibility: repoVisibility(input.repoVisibility),
    path: optionalString(input.path),
    ref: optionalString(input.ref),
    defaultBranch: optionalString(input.defaultBranch),
    ownerUserId: optionalString(input.ownerUserId),
    installationId: optionalString(input.installationId)
  };
}

function recordScanInput(input: Record<string, unknown>): RecordSourceScanInput {
  return {
    sourceId: String(input.sourceId ?? ""),
    ref: optionalString(input.ref),
    commitSha: optionalString(input.commitSha),
    treeChecksum: optionalString(input.treeChecksum),
    scanStatus: scanStatus(input.scanStatus),
    scanSummary: objectRecord(input.scanSummary),
    candidates: Array.isArray(input.candidates) ? input.candidates as CreateLogicCapsuleInput[] : undefined
  };
}

function createCapsuleInput(input: Record<string, unknown>): CreateLogicCapsuleInput {
  return {
    sourceId: String(input.sourceId ?? ""),
    slug: optionalString(input.slug),
    name: String(input.name ?? ""),
    purpose: String(input.purpose ?? ""),
    reuseMode: reuseMode(input.reuseMode),
    sourcePath: optionalString(input.sourcePath) ?? optionalString(input.path),
    files: stringList(input.files),
    tests: stringList(input.tests),
    dependencies: stringList(input.dependencies),
    requiredEnv: stringList(input.requiredEnv),
    inputs: stringList(input.inputs),
    outputs: stringList(input.outputs),
    usageNotes: optionalString(input.usageNotes),
    constraints: stringList(input.constraints),
    doNotUseFor: stringList(input.doNotUseFor),
    checksum: optionalString(input.checksum),
    approvalStatus: approvalStatus(input.approvalStatus)
  };
}

function searchInput(input: Record<string, unknown>): SearchLogicCapsulesInput {
  return {
    query: optionalString(input.query),
    approvalStatus: approvalStatus(input.approvalStatus),
    limit: limit(input.limit)
  };
}

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Code Memory tool call failed.");
  return result.data;
}

export function createCodeMemoryToolHandlers(deps: CodeMemoryToolHandlerDeps): Record<string, CodeMemoryToolHandler> {
  const service = deps.service;
  const ctx = (toolCtx?: CodeMemoryToolContext) => tenantContext(toolCtx, deps.defaultTenantId);

  return {
    "code-memory_addTrustedSource": async (input, toolCtx) => unwrap(await service.addTrustedSource(ctx(toolCtx), trustedSourceInput(input))),
    "code-memory_listTrustedSources": async (input, toolCtx) => unwrap(await service.listTrustedSources(ctx(toolCtx), Number(input.limit ?? 50))),
    "code-memory_recordSourceScan": async (input, toolCtx) => unwrap(await service.recordSourceScan(ctx(toolCtx), recordScanInput(input))),
    "code-memory_createLogicCapsule": async (input, toolCtx) => unwrap(await service.createLogicCapsule(ctx(toolCtx), createCapsuleInput(input))),
    "code-memory_searchLogicCapsules": async (input, toolCtx) => unwrap(await service.searchLogicCapsules(ctx(toolCtx), searchInput(input))),
    "code-memory_getLogicCapsule": async (input, toolCtx) => unwrap(await service.getLogicCapsule(ctx(toolCtx), idOrSlug(input))),
    "code-memory_approveLogicCapsule": async (input, toolCtx) => unwrap(await service.approveLogicCapsule(ctx(toolCtx), idOrSlug(input))),
    "code-memory_rejectLogicCapsule": async (input, toolCtx) => unwrap(await service.rejectLogicCapsule(ctx(toolCtx), idOrSlug(input)))
  };
}
