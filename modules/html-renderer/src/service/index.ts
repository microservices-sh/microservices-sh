import type { HtmlRendererStore } from "../ports";
import type {
  CreateHtmlRenderInput,
  DeleteHtmlRenderInput,
  HtmlRenderAsset,
  HtmlRenderDocument,
  HtmlRendererConfig,
  HtmlRendererIdFactory,
  HtmlRendererIdPrefix,
  HtmlRendererSlugFactory,
  ModuleResult,
  ResolveHtmlRenderInput,
  TenantContext
} from "../types";

const RESERVED_SLUGS = new Set(["api", "_app", "assets", "favicon.ico", "robots.txt"]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export interface HtmlRendererServiceDeps {
  store: HtmlRendererStore;
  createId?: HtmlRendererIdFactory;
  createSlug?: HtmlRendererSlugFactory;
  config?: HtmlRendererConfig;
}

export interface HtmlRendererService {
  createHtmlRender(ctx: TenantContext, input: CreateHtmlRenderInput): Promise<ModuleResult<HtmlRenderDocument>>;
  resolveHtmlRender(ctx: TenantContext, input: ResolveHtmlRenderInput): Promise<ModuleResult<HtmlRenderDocument>>;
  deleteHtmlRender(ctx: TenantContext, input: DeleteHtmlRenderInput): Promise<ModuleResult<HtmlRenderDocument>>;
  listHtmlRenders(ctx: TenantContext, limit?: number): Promise<ModuleResult<HtmlRenderDocument[]>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function failFrom<T>(result: ModuleResult<unknown>): ModuleResult<T> {
  return fail(result.error?.code ?? "operation_failed", result.error?.message ?? "Operation failed.");
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialHtmlRendererIdFactory(): HtmlRendererIdFactory {
  let sequence = 0;
  return (prefix: HtmlRendererIdPrefix) => id(prefix, ++sequence);
}

export function createSequentialHtmlRendererSlugFactory(): HtmlRendererSlugFactory {
  let sequence = 0;
  return () => `h${(++sequence).toString(36).padStart(7, "0")}`;
}

function defaultId(prefix: HtmlRendererIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function defaultSlug(): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function addSeconds(value: string, seconds: number): string {
  const date = new Date(value);
  date.setUTCSeconds(date.getUTCSeconds() + seconds);
  return date.toISOString();
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validateSlug(value: string): ModuleResult<string> {
  const slug = value.trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) return fail("slug_invalid", "Slug must be 1-64 lowercase alphanumeric or hyphen characters and cannot be reserved.");
  return ok(slug);
}

function validateTtl(value: number | null | undefined, minTtlSeconds: number, maxTtlSeconds: number): ModuleResult<number | null> {
  if (value == null) return ok(null);
  if (!Number.isInteger(value) || value < 0) return fail("ttl_invalid", "TTL must be a non-negative integer number of seconds.");
  if (value === 0) return ok(0);
  if (value < minTtlSeconds) return fail("ttl_too_short", `TTL must be 0 or at least ${minTtlSeconds} seconds.`);
  if (value > maxTtlSeconds) return fail("ttl_too_long", `TTL must be ${maxTtlSeconds} seconds or less.`);
  return ok(value);
}

function validateAssets(assets: HtmlRenderAsset[] | undefined): ModuleResult<HtmlRenderAsset[]> {
  const cleaned: HtmlRenderAsset[] = [];
  for (const asset of assets ?? []) {
    const path = cleanText(asset.path);
    const mimeType = cleanText(asset.mimeType) ?? "application/octet-stream";
    if (!path || path.startsWith("/") || path.includes("..")) return fail("asset_path_invalid", "Asset path must be relative and cannot contain parent traversal.");
    if (!Number.isInteger(asset.sizeBytes) || asset.sizeBytes < 0) return fail("asset_size_invalid", "Asset size must be a non-negative integer.");
    cleaned.push({ path, mimeType, sizeBytes: asset.sizeBytes });
  }
  return ok(cleaned);
}

export function createHtmlRendererService(deps: HtmlRendererServiceDeps): HtmlRendererService {
  const createId = deps.createId ?? defaultId;
  const createSlug = deps.createSlug ?? defaultSlug;
  const defaultTtlSeconds = deps.config?.defaultTtlSeconds ?? 2592000;
  const minTtlSeconds = deps.config?.minTtlSeconds ?? 60;
  const maxTtlSeconds = deps.config?.maxTtlSeconds ?? 2592000;
  const maxHtmlBytes = deps.config?.maxHtmlBytes ?? 26214400;

  return {
    async createHtmlRender(ctx, input) {
      const html = cleanText(input.html);
      if (!html) return fail("html_required", "HTML content is required.");
      if (byteLength(html) > maxHtmlBytes) return fail("html_too_large", "HTML content exceeds the configured size limit.");
      const ttl = validateTtl(input.ttlSeconds ?? defaultTtlSeconds, minTtlSeconds, maxTtlSeconds);
      if (!ttl.ok) return failFrom<HtmlRenderDocument>(ttl);
      const assets = validateAssets(input.assets);
      if (!assets.ok || !assets.data) return failFrom<HtmlRenderDocument>(assets);

      let slug: string | null = null;
      if (input.slug) {
        const validated = validateSlug(input.slug);
        if (!validated.ok || !validated.data) return failFrom<HtmlRenderDocument>(validated);
        slug = validated.data;
        if (await deps.store.getDocumentBySlug(ctx.tenantId, slug)) return fail("slug_taken", "Slug already exists.");
      } else {
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = createSlug();
          if (!(await deps.store.getDocumentBySlug(ctx.tenantId, candidate))) {
            slug = candidate;
            break;
          }
        }
        if (!slug) return fail("slug_generation_failed", "Failed to generate a unique slug.");
      }

      const timestamp = now(ctx);
      const ttlSeconds = ttl.data === 0 ? null : ttl.data ?? null;
      const document: HtmlRenderDocument = {
        id: createId("hdoc"),
        tenantId: ctx.tenantId,
        slug,
        html,
        assets: assets.data,
        ttlSeconds,
        expiresAt: ttlSeconds ? addSeconds(timestamp, ttlSeconds) : null,
        status: "active",
        createdBy: cleanText(ctx.actorId),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null
      };
      await deps.store.upsertDocument(document);
      return ok(document);
    },

    async resolveHtmlRender(ctx, input) {
      const slug = cleanText(input.slug);
      if (!slug) return fail("slug_required", "Slug is required.");
      const document = await deps.store.getDocumentBySlug(ctx.tenantId, slug);
      if (!document) return fail("document_not_found", "HTML render document was not found.");
      if (document.status !== "active") return fail("document_deleted", "HTML render document was deleted.");
      if (document.expiresAt && document.expiresAt <= now(ctx)) return fail("document_expired", "HTML render document has expired.");
      return ok(document);
    },

    async deleteHtmlRender(ctx, input) {
      const slug = cleanText(input.slug);
      if (!slug) return fail("slug_required", "Slug is required.");
      const document = await deps.store.getDocumentBySlug(ctx.tenantId, slug);
      if (!document) return fail("document_not_found", "HTML render document was not found.");
      const timestamp = now(ctx);
      const updated = { ...document, status: "deleted" as const, updatedAt: timestamp, deletedAt: timestamp };
      await deps.store.upsertDocument(updated);
      return ok(updated);
    },

    async listHtmlRenders(ctx, limit = 20) {
      return ok(await deps.store.listDocuments(ctx.tenantId, limit));
    }
  };
}

export function getHtmlRendererModuleStatus() {
  return { id: "html-renderer", status: "draft" } as const;
}
