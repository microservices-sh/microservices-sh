import type { RecurringInvoiceStore } from "../ports";
import type {
  RecurringInvoiceTemplate,
  RecurringInvoiceTemplateFilter,
  RecurringInvoiceTemplateLineItem,
  RecurringInvoiceTemplateWithLineItems
} from "../types";

function withLineItems(
  template: RecurringInvoiceTemplate,
  lines: RecurringInvoiceTemplateLineItem[]
): RecurringInvoiceTemplateWithLineItems {
  return { ...template, lineItems: lines.map((line) => ({ ...line })) };
}

function matchesFilter(template: RecurringInvoiceTemplate, filter: RecurringInvoiceTemplateFilter): boolean {
  if (template.tenantId !== filter.tenantId) return false;
  if (filter.customerId && template.customerId !== filter.customerId) return false;
  if (filter.status && template.status !== filter.status) return false;
  if (filter.statuses && !filter.statuses.includes(template.status)) return false;
  if (filter.dueOnOrBefore) {
    if (!template.nextInvoiceAt || template.nextInvoiceAt > filter.dueOnOrBefore) return false;
  }
  return true;
}

export function createMemoryRecurringInvoiceStore(): RecurringInvoiceStore {
  const templates = new Map<string, RecurringInvoiceTemplate>();
  const linesByTemplate = new Map<string, RecurringInvoiceTemplateLineItem[]>();

  return {
    async insertTemplate(template, lineItems) {
      templates.set(template.id, { ...template });
      linesByTemplate.set(
        template.id,
        lineItems.map((line) => ({ ...line }))
      );
    },

    async getTemplate(tenantId, templateId) {
      const template = templates.get(templateId);
      if (!template || template.tenantId !== tenantId) return null;
      return withLineItems(template, linesByTemplate.get(template.id) ?? []);
    },

    async listTemplates(filter) {
      return [...templates.values()]
        .filter((template) => matchesFilter(template, filter))
        .sort((a, b) => {
          const date = (a.nextInvoiceAt ?? "").localeCompare(b.nextInvoiceAt ?? "");
          return date === 0 ? a.name.localeCompare(b.name) : date;
        })
        .slice(0, filter.limit ?? 100)
        .map((template) => withLineItems(template, linesByTemplate.get(template.id) ?? []));
    },

    async updateTemplate(template) {
      if (templates.has(template.id)) templates.set(template.id, { ...template });
    }
  };
}
