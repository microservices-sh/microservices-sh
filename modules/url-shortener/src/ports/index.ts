import type { RecentShortLink, ShortLink, ShortLinkClick } from "../types";

export interface UrlShortenerStore {
  getLink(tenantId: string, linkId: string): Promise<ShortLink | null>;
  getLinkByCode(tenantId: string, code: string): Promise<ShortLink | null>;
  insertLink(link: ShortLink): Promise<void>;
  updateLink(link: ShortLink): Promise<void>;

  insertClick(click: ShortLinkClick): Promise<void>;
  listClicksForLink(tenantId: string, linkId: string): Promise<ShortLinkClick[]>;
  listRecentLinksWithCounts(tenantId: string, limit?: number): Promise<RecentShortLink[]>;
}
