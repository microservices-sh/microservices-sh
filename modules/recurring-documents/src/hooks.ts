import type { CreateRecurringDocumentTemplateInput, GeneratedRecurringDocumentDraft, RecurringDocumentTemplate, UpdateRecurringDocumentTemplateInput } from "./types";

export interface RecurringDocumentsHooks {
  beforeRecurringDocumentTemplateCreate?: (input: CreateRecurringDocumentTemplateInput) => Promise<CreateRecurringDocumentTemplateInput> | CreateRecurringDocumentTemplateInput;
  beforeRecurringDocumentTemplateUpdate?: (input: UpdateRecurringDocumentTemplateInput) => Promise<UpdateRecurringDocumentTemplateInput> | UpdateRecurringDocumentTemplateInput;
  afterRecurringDocumentTemplateUpdated?: (record: RecurringDocumentTemplate) => Promise<void> | void;
  afterRecurringDocumentGenerated?: (draft: GeneratedRecurringDocumentDraft) => Promise<void> | void;
}

export const defaultRecurringDocumentsHooks: Required<RecurringDocumentsHooks> = {
  beforeRecurringDocumentTemplateCreate(input) {
    return input;
  },
  beforeRecurringDocumentTemplateUpdate(input) {
    return input;
  },
  afterRecurringDocumentTemplateUpdated() {
    return undefined;
  },
  afterRecurringDocumentGenerated() {
    return undefined;
  }
};
