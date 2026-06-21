export interface HtmlRendererConfig {
  enabled: boolean;
  defaultTtlSeconds?: number;
  minTtlSeconds?: number;
  maxTtlSeconds?: number;
  maxHtmlBytes?: number;
}

export type HtmlRendererIdPrefix = "hdoc";
export type HtmlRendererIdFactory = (prefix: HtmlRendererIdPrefix) => string;
export type HtmlRendererSlugFactory = () => string;
export type HtmlDocumentStatus = "active" | "deleted";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface HtmlRenderAsset {
  path: string;
  mimeType: string;
  sizeBytes: number;
}

export interface HtmlRenderDocument {
  id: string;
  tenantId: string;
  slug: string;
  html: string;
  assets: HtmlRenderAsset[];
  ttlSeconds: number | null;
  expiresAt: string | null;
  status: HtmlDocumentStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateHtmlRenderInput {
  html: string;
  slug?: string | null;
  ttlSeconds?: number | null;
  assets?: HtmlRenderAsset[];
}

export interface ResolveHtmlRenderInput {
  slug: string;
}

export interface DeleteHtmlRenderInput {
  slug: string;
}

export type HtmlRendererRecord = HtmlRenderDocument;

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
