import type { HtmlRenderDocument } from "../types";

export interface HtmlRendererStore {
  getDocument(tenantId: string, documentId: string): Promise<HtmlRenderDocument | null>;
  getDocumentBySlug(tenantId: string, slug: string): Promise<HtmlRenderDocument | null>;
  upsertDocument(document: HtmlRenderDocument): Promise<void>;
  listDocuments(tenantId: string, limit?: number): Promise<HtmlRenderDocument[]>;
}
