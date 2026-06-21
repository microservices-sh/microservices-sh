export interface UrlShortenerConfig {
  enabled: boolean;
  baseUrl?: string;
  defaultCodeLength?: number;
  maxExpiryDays?: number;
}

export type UrlShortenerIdPrefix = "uslink" | "usclk";
export type UrlShortenerIdFactory = (prefix: UrlShortenerIdPrefix) => string;
export type UrlShortenerCodeFactory = (length: number) => string;
export type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface ShortLink {
  id: string;
  tenantId: string;
  code: string;
  originalUrl: string;
  customAlias: boolean;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShortLinkClick {
  id: string;
  tenantId: string;
  linkId: string;
  code: string;
  clickedAt: string;
  country: string | null;
  city: string | null;
  region: string | null;
  deviceType: DeviceType;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  referrer: string | null;
}

export interface ClickAnalyticsInput {
  country?: string | null;
  city?: string | null;
  region?: string | null;
  deviceType?: DeviceType;
  browser?: string | null;
  browserVersion?: string | null;
  os?: string | null;
  osVersion?: string | null;
  referrer?: string | null;
}

export interface CreateShortLinkInput {
  url: string;
  customAlias?: string | null;
  expiresInDays?: number | null;
}

export interface ResolveShortLinkInput {
  code: string;
  analytics?: ClickAnalyticsInput;
}

export interface DeactivateShortLinkInput {
  code: string;
}

export interface GetShortLinkStatsInput {
  code: string;
  days?: number;
}

export interface ShortLinkResolution {
  link: ShortLink;
  originalUrl: string;
}

export interface RecentShortLink {
  link: ShortLink;
  clicks: number;
}

export interface CountByDate {
  date: string;
  count: number;
}

export interface CountShare {
  name: string;
  count: number;
  percentage: number;
}

export interface ShortLinkStats {
  link: ShortLink;
  totalClicks: number;
  uniqueCountries: number;
  clicksByDate: CountByDate[];
  clicksByCountry: CountShare[];
  clicksByDevice: CountShare[];
  clicksByBrowser: CountShare[];
  clicksByOS: CountShare[];
  clicksByReferrer: CountShare[];
  recentClicks: ShortLinkClick[];
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type UrlShortenerRecord = ShortLink;
