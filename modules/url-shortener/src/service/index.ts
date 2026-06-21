import type { UrlShortenerStore } from "../ports";
import type {
  ClickAnalyticsInput,
  CountShare,
  CreateShortLinkInput,
  DeactivateShortLinkInput,
  DeviceType,
  GetShortLinkStatsInput,
  ModuleResult,
  RecentShortLink,
  ResolveShortLinkInput,
  ShortLink,
  ShortLinkClick,
  ShortLinkResolution,
  ShortLinkStats,
  TenantContext,
  UrlShortenerCodeFactory,
  UrlShortenerConfig,
  UrlShortenerIdFactory,
  UrlShortenerIdPrefix
} from "../types";

const CHARSET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RESERVED_ALIASES = new Set(["api", "stats", "admin", "login", "signup", "health", "favicon"]);

export interface UrlShortenerServiceDeps {
  store: UrlShortenerStore;
  createId?: UrlShortenerIdFactory;
  createCode?: UrlShortenerCodeFactory;
  config?: UrlShortenerConfig;
}

export interface UrlShortenerService {
  createShortLink(ctx: TenantContext, input: CreateShortLinkInput): Promise<ModuleResult<ShortLink>>;
  resolveShortLink(ctx: TenantContext, input: ResolveShortLinkInput): Promise<ModuleResult<ShortLinkResolution>>;
  deactivateShortLink(ctx: TenantContext, input: DeactivateShortLinkInput): Promise<ModuleResult<ShortLink>>;
  getShortLinkStats(ctx: TenantContext, input: GetShortLinkStatsInput): Promise<ModuleResult<ShortLinkStats>>;
  listRecentLinks(ctx: TenantContext, limit?: number): Promise<ModuleResult<RecentShortLink[]>>;
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

export function createSequentialUrlShortenerIdFactory(): UrlShortenerIdFactory {
  const sequences: Record<UrlShortenerIdPrefix, number> = { uslink: 0, usclk: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

export function createSequentialUrlShortenerCodeFactory(): UrlShortenerCodeFactory {
  let sequence = 0;
  return () => `u${(++sequence).toString(36).padStart(5, "0")}`;
}

function defaultId(prefix: UrlShortenerIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function defaultCode(length: number): string {
  return Array.from({ length }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join("");
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normalizeUrl(value: string): ModuleResult<string> {
  const trimmed = value?.trim();
  if (!trimmed) return fail("url_required", "URL is required.");
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    if (!["http:", "https:"].includes(parsed.protocol)) return fail("url_protocol_invalid", "URL must use http or https.");
    if (!hostname || hostname.length < 3) return fail("url_hostname_invalid", "URL hostname is invalid.");
    if (hostname === "localhost" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname)) {
      return fail("url_private_not_allowed", "Cannot shorten localhost or private URLs.");
    }
    return ok(parsed.toString());
  } catch {
    return fail("url_invalid", "URL format is invalid.");
  }
}

function validateAlias(alias: string): ModuleResult<string> {
  if (alias.length < 3) return fail("alias_too_short", "Alias must be at least 3 characters.");
  if (alias.length > 32) return fail("alias_too_long", "Alias must be 32 characters or less.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$/.test(alias)) return fail("alias_invalid", "Alias must start and end with an alphanumeric character and contain only letters, numbers, hyphens, or underscores.");
  if (RESERVED_ALIASES.has(alias.toLowerCase())) return fail("alias_reserved", "Alias is reserved.");
  return ok(alias);
}

function validateExpiryDays(value: number | null | undefined, maxExpiryDays: number): ModuleResult<number | null> {
  if (value == null) return ok(null);
  if (!Number.isInteger(value) || value <= 0) return fail("expiry_invalid", "Expiry must be a positive number of days.");
  if (value > maxExpiryDays) return fail("expiry_too_long", `Expiry must be ${maxExpiryDays} days or less.`);
  return ok(value);
}

function cleanDeviceType(value: DeviceType | undefined): DeviceType {
  return value ?? "unknown";
}

function createClick(ctx: TenantContext, link: ShortLink, analytics: ClickAnalyticsInput | undefined, createId: UrlShortenerIdFactory): ShortLinkClick {
  return {
    id: createId("usclk"),
    tenantId: ctx.tenantId,
    linkId: link.id,
    code: link.code,
    clickedAt: now(ctx),
    country: cleanText(analytics?.country),
    city: cleanText(analytics?.city),
    region: cleanText(analytics?.region),
    deviceType: cleanDeviceType(analytics?.deviceType),
    browser: cleanText(analytics?.browser),
    browserVersion: cleanText(analytics?.browserVersion),
    os: cleanText(analytics?.os),
    osVersion: cleanText(analytics?.osVersion),
    referrer: cleanText(analytics?.referrer)
  };
}

function countShare(values: Array<string | null | undefined>, total: number, limit = 10): CountShare[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = cleanText(value) ?? "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }));
}

function dateCounts(clicks: ShortLinkClick[], since: string): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();
  for (const click of clicks) {
    if (click.clickedAt < since) continue;
    const date = click.clickedAt.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
}

export function createUrlShortenerService(deps: UrlShortenerServiceDeps): UrlShortenerService {
  const createId = deps.createId ?? defaultId;
  const createCode = deps.createCode ?? defaultCode;
  const defaultCodeLength = deps.config?.defaultCodeLength ?? 6;
  const maxExpiryDays = deps.config?.maxExpiryDays ?? 365;

  return {
    async createShortLink(ctx, input) {
      const normalizedUrl = normalizeUrl(input.url);
      if (!normalizedUrl.ok || !normalizedUrl.data) return failFrom<ShortLink>(normalizedUrl);
      const expiryDays = validateExpiryDays(input.expiresInDays, maxExpiryDays);
      if (!expiryDays.ok) return failFrom<ShortLink>(expiryDays);

      const customAlias = cleanText(input.customAlias);
      let code: string;
      let isCustomAlias = false;

      if (customAlias) {
        const alias = validateAlias(customAlias);
        if (!alias.ok || !alias.data) return failFrom<ShortLink>(alias);
        if (await deps.store.getLinkByCode(ctx.tenantId, alias.data)) return fail("alias_taken", "Alias is already taken.");
        code = alias.data;
        isCustomAlias = true;
      } else {
        let generated: string | null = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = createCode(defaultCodeLength);
          if (!(await deps.store.getLinkByCode(ctx.tenantId, candidate))) {
            generated = candidate;
            break;
          }
        }
        if (!generated) return fail("code_generation_failed", "Failed to generate a unique short code.");
        code = generated;
      }

      const timestamp = now(ctx);
      const link: ShortLink = {
        id: createId("uslink"),
        tenantId: ctx.tenantId,
        code,
        originalUrl: normalizedUrl.data,
        customAlias: isCustomAlias,
        expiresAt: expiryDays.data ? addDays(timestamp, expiryDays.data) : null,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.insertLink(link);
      return ok(link);
    },

    async resolveShortLink(ctx, input) {
      const code = cleanText(input.code);
      if (!code) return fail("code_required", "Short code is required.");
      const link = await deps.store.getLinkByCode(ctx.tenantId, code);
      if (!link) return fail("link_not_found", "Short link was not found.");
      if (!link.isActive) return fail("link_disabled", "Short link is disabled.");
      if (link.expiresAt && link.expiresAt <= now(ctx)) return fail("link_expired", "Short link has expired.");
      await deps.store.insertClick(createClick(ctx, link, input.analytics, createId));
      return ok({ link, originalUrl: link.originalUrl });
    },

    async deactivateShortLink(ctx, input) {
      const code = cleanText(input.code);
      if (!code) return fail("code_required", "Short code is required.");
      const link = await deps.store.getLinkByCode(ctx.tenantId, code);
      if (!link) return fail("link_not_found", "Short link was not found.");
      const updated = { ...link, isActive: false, updatedAt: now(ctx) };
      await deps.store.updateLink(updated);
      return ok(updated);
    },

    async getShortLinkStats(ctx, input) {
      const code = cleanText(input.code);
      if (!code) return fail("code_required", "Short code is required.");
      const link = await deps.store.getLinkByCode(ctx.tenantId, code);
      if (!link) return fail("link_not_found", "Short link was not found.");
      const days = Number.isInteger(input.days) && input.days && input.days > 0 ? input.days : 30;
      const since = addDays(now(ctx), -days);
      const clicks = await deps.store.listClicksForLink(ctx.tenantId, link.id);
      const total = clicks.length;
      return ok({
        link,
        totalClicks: total,
        uniqueCountries: new Set(clicks.map((click) => click.country).filter(Boolean)).size,
        clicksByDate: dateCounts(clicks, since),
        clicksByCountry: countShare(clicks.map((click) => click.country), total),
        clicksByDevice: countShare(clicks.map((click) => click.deviceType), total),
        clicksByBrowser: countShare(clicks.map((click) => click.browser), total, 5),
        clicksByOS: countShare(clicks.map((click) => click.os), total, 5),
        clicksByReferrer: countShare(clicks.map((click) => click.referrer), total),
        recentClicks: clicks.slice(0, 20)
      });
    },

    async listRecentLinks(ctx, limit = 10) {
      return ok(await deps.store.listRecentLinksWithCounts(ctx.tenantId, limit));
    }
  };
}

export function getUrlShortenerModuleStatus() {
  return { id: "url-shortener", status: "draft" } as const;
}
