export interface KnowledgeBaseRagHooks {
  beforeArticleCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeArticleUpdate?: (input: unknown) => Promise<unknown> | unknown;
  afterAttachmentAdded?: (attachment: unknown) => Promise<void> | void;
  afterGroundedAnswerDrafted?: (draft: unknown) => Promise<void> | void;
}

export const defaultKnowledgeBaseRagHooks: Required<KnowledgeBaseRagHooks> = {
  beforeArticleCreate(input) {
    return input;
  },
  beforeArticleUpdate(input) {
    return input;
  },
  afterAttachmentAdded() {
    return undefined;
  },
  afterGroundedAnswerDrafted() {
    return undefined;
  }
};
