import type { UrlShortenerStore } from "../ports";
import type { RecentShortLink, ShortLink, ShortLinkClick } from "../types";

export interface UrlShortenerMemoryStoreState {
  links?: ShortLink[];
  clicks?: ShortLinkClick[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function codeKey(tenantId: string, code: string): string {
  return `${tenantId}:${code.toLowerCase()}`;
}

export function createUrlShortenerMemoryStore(initialState: UrlShortenerMemoryStoreState = {}): UrlShortenerStore {
  const links = new Map<string, ShortLink>();
  const codes = new Map<string, string>();
  const clicks = new Map<string, ShortLinkClick>();

  for (const link of initialState.links ?? []) {
    links.set(link.id, copy(link));
    codes.set(codeKey(link.tenantId, link.code), link.id);
  }
  for (const click of initialState.clicks ?? []) clicks.set(click.id, copy(click));

  return {
    async getLink(tenantId, linkId) {
      const link = links.get(linkId);
      return link?.tenantId === tenantId ? copy(link) : null;
    },
    async getLinkByCode(tenantId, code) {
      const id = codes.get(codeKey(tenantId, code));
      const link = id ? links.get(id) : null;
      return link ? copy(link) : null;
    },
    async insertLink(link) {
      links.set(link.id, copy(link));
      codes.set(codeKey(link.tenantId, link.code), link.id);
    },
    async updateLink(link) {
      const existing = links.get(link.id);
      if (existing) codes.delete(codeKey(existing.tenantId, existing.code));
      links.set(link.id, copy(link));
      codes.set(codeKey(link.tenantId, link.code), link.id);
    },
    async insertClick(click) {
      clicks.set(click.id, copy(click));
    },
    async listClicksForLink(tenantId, linkId) {
      return [...clicks.values()]
        .filter((click) => click.tenantId === tenantId && click.linkId === linkId)
        .sort((a, b) => b.clickedAt.localeCompare(a.clickedAt))
        .map(copy);
    },
    async listRecentLinksWithCounts(tenantId, limit = 10) {
      const rows = [...links.values()]
        .filter((link) => link.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
      return rows.map((link): RecentShortLink => ({
        link: copy(link),
        clicks: [...clicks.values()].filter((click) => click.tenantId === tenantId && click.linkId === link.id).length
      }));
    }
  };
}
