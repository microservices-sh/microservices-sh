import type { UrlShortenerStore } from "../ports";
import type { DeviceType, RecentShortLink, ShortLink, ShortLinkClick } from "../types";

const LINK_COLS = "id, tenant_id, code, original_url, custom_alias, expires_at, is_active, created_at, updated_at";
const CLICK_COLS = "id, tenant_id, link_id, code, clicked_at, country, city, region, device_type, browser, browser_version, os, os_version, referrer";

function bool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function toLink(row: Record<string, unknown>): ShortLink {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    originalUrl: String(row.original_url),
    customAlias: bool(row.custom_alias),
    expiresAt: nullable(row.expires_at),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toClick(row: Record<string, unknown>): ShortLinkClick {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    linkId: String(row.link_id),
    code: String(row.code),
    clickedAt: String(row.clicked_at),
    country: nullable(row.country),
    city: nullable(row.city),
    region: nullable(row.region),
    deviceType: String(row.device_type ?? "unknown") as DeviceType,
    browser: nullable(row.browser),
    browserVersion: nullable(row.browser_version),
    os: nullable(row.os),
    osVersion: nullable(row.os_version),
    referrer: nullable(row.referrer)
  };
}

export function createD1UrlShortenerStore(db: D1Database): UrlShortenerStore {
  return {
    async getLink(tenantId, linkId) {
      const row = await db.prepare(`SELECT ${LINK_COLS} FROM url_short_links WHERE tenant_id = ? AND id = ?`).bind(tenantId, linkId).first<Record<string, unknown>>();
      return row ? toLink(row) : null;
    },
    async getLinkByCode(tenantId, code) {
      const row = await db.prepare(`SELECT ${LINK_COLS} FROM url_short_links WHERE tenant_id = ? AND code = ?`).bind(tenantId, code).first<Record<string, unknown>>();
      return row ? toLink(row) : null;
    },
    async insertLink(link) {
      await db.prepare(`INSERT INTO url_short_links (${LINK_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(link.id, link.tenantId, link.code, link.originalUrl, link.customAlias ? 1 : 0, link.expiresAt, link.isActive ? 1 : 0, link.createdAt, link.updatedAt)
        .run();
    },
    async updateLink(link) {
      await db.prepare("UPDATE url_short_links SET original_url = ?, expires_at = ?, is_active = ?, updated_at = ? WHERE tenant_id = ? AND id = ?")
        .bind(link.originalUrl, link.expiresAt, link.isActive ? 1 : 0, link.updatedAt, link.tenantId, link.id)
        .run();
    },
    async insertClick(click) {
      await db.prepare(`INSERT INTO url_short_link_clicks (${CLICK_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(click.id, click.tenantId, click.linkId, click.code, click.clickedAt, click.country, click.city, click.region, click.deviceType, click.browser, click.browserVersion, click.os, click.osVersion, click.referrer)
        .run();
    },
    async listClicksForLink(tenantId, linkId) {
      const result = await db.prepare(`SELECT ${CLICK_COLS} FROM url_short_link_clicks WHERE tenant_id = ? AND link_id = ? ORDER BY clicked_at DESC`).bind(tenantId, linkId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toClick);
    },
    async listRecentLinksWithCounts(tenantId, limit = 10) {
      const result = await db
        .prepare(
          `SELECT ${LINK_COLS}, COUNT(c.id) AS click_count
           FROM url_short_links l
           LEFT JOIN url_short_link_clicks c ON c.tenant_id = l.tenant_id AND c.link_id = l.id
           WHERE l.tenant_id = ?
           GROUP BY l.id
           ORDER BY l.created_at DESC
           LIMIT ?`
        )
        .bind(tenantId, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map((row): RecentShortLink => ({ link: toLink(row), clicks: Number(row.click_count ?? 0) }));
    }
  };
}
