import type { HtmlRendererStore } from "../ports";
import type { HtmlRenderDocument } from "../types";

export interface HtmlRendererMemoryStoreState {
  documents?: HtmlRenderDocument[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function slugKey(tenantId: string, slug: string): string {
  return `${tenantId}:${slug}`;
}

export function createHtmlRendererMemoryStore(initialState: HtmlRendererMemoryStoreState = {}): HtmlRendererStore {
  const documents = new Map<string, HtmlRenderDocument>();
  const slugs = new Map<string, string>();

  for (const document of initialState.documents ?? []) {
    documents.set(document.id, copy(document));
    slugs.set(slugKey(document.tenantId, document.slug), document.id);
  }

  return {
    async getDocument(tenantId, documentId) {
      const document = documents.get(documentId);
      return document?.tenantId === tenantId ? copy(document) : null;
    },
    async getDocumentBySlug(tenantId, slug) {
      const id = slugs.get(slugKey(tenantId, slug));
      const document = id ? documents.get(id) : null;
      return document ? copy(document) : null;
    },
    async upsertDocument(document) {
      const existing = documents.get(document.id);
      if (existing) slugs.delete(slugKey(existing.tenantId, existing.slug));
      documents.set(document.id, copy(document));
      slugs.set(slugKey(document.tenantId, document.slug), document.id);
    },
    async listDocuments(tenantId, limit = 20) {
      return [...documents.values()]
        .filter((document) => document.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(copy);
    }
  };
}
