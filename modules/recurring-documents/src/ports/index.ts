import type { RecurringDocumentListFilter, RecurringDocumentTemplate, RecurringTemplateStatus } from "../types";

export interface RecurringDocumentsStore {
  getTemplate(tenantId: string, templateId: string): Promise<RecurringDocumentTemplate | null>;
  insertTemplate(template: RecurringDocumentTemplate): Promise<void>;
  updateTemplate(template: RecurringDocumentTemplate): Promise<void>;
  listTemplates(tenantId: string, filter?: RecurringDocumentListFilter): Promise<{ templates: RecurringDocumentTemplate[]; total: number }>;
  listDueTemplates(tenantId: string, asOf: string, limit?: number): Promise<RecurringDocumentTemplate[]>;
  countTemplatesByStatus(tenantId: string): Promise<Record<RecurringTemplateStatus, number>>;
}
