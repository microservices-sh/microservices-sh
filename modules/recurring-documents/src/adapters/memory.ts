import type { RecurringDocumentsStore } from "../ports";
import type { RecurringDocumentListFilter, RecurringDocumentTemplate, RecurringTemplateStatus } from "../types";

export interface RecurringDocumentsMemoryStoreState {
  templates?: RecurringDocumentTemplate[];
}

const STATUSES: RecurringTemplateStatus[] = ["active", "paused", "completed", "cancelled"];

function copy<T>(value: T): T {
  return structuredClone(value);
}

function matchesFilter(template: RecurringDocumentTemplate, filter?: RecurringDocumentListFilter): boolean {
  if (filter?.documentType && template.documentType !== filter.documentType) return false;
  if (filter?.partyId && template.partyId !== filter.partyId) return false;
  if (filter?.status && template.status !== filter.status) return false;
  if (filter?.dueBefore && (template.nextRunDate === null || template.nextRunDate > filter.dueBefore)) return false;
  return true;
}

export function createRecurringDocumentsMemoryStore(initialState: RecurringDocumentsMemoryStoreState = {}): RecurringDocumentsStore {
  const templates = new Map<string, RecurringDocumentTemplate>();
  for (const template of initialState.templates ?? []) templates.set(template.id, copy(template));

  return {
    async getTemplate(tenantId, templateId) {
      const template = templates.get(templateId);
      return template?.tenantId === tenantId ? copy(template) : null;
    },

    async insertTemplate(template) {
      templates.set(template.id, copy(template));
    },

    async updateTemplate(template) {
      templates.set(template.id, copy(template));
    },

    async listTemplates(tenantId, filter) {
      const rows = [...templates.values()]
        .filter((template) => template.tenantId === tenantId && matchesFilter(template, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? rows.length;
      return { templates: rows.slice(offset, offset + limit).map(copy), total: rows.length };
    },

    async listDueTemplates(tenantId, asOf, limit) {
      const rows = [...templates.values()]
        .filter((template) => template.tenantId === tenantId && template.status === "active" && template.nextRunDate !== null && template.nextRunDate <= asOf)
        .sort((a, b) => (a.nextRunDate ?? "").localeCompare(b.nextRunDate ?? ""));
      return rows.slice(0, limit ?? rows.length).map(copy);
    },

    async countTemplatesByStatus(tenantId) {
      const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<RecurringTemplateStatus, number>;
      for (const template of templates.values()) {
        if (template.tenantId === tenantId) counts[template.status] += 1;
      }
      return counts;
    }
  };
}
