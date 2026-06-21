export interface ContentCmsHooks {
  beforeContentTypeCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeEntryPublish?: (input: unknown) => Promise<unknown> | unknown;
  afterEntryPublished?: (record: unknown) => Promise<void> | void;
  afterMediaCreated?: (record: unknown) => Promise<void> | void;
}

export const defaultContentCmsHooks: Required<ContentCmsHooks> = {
  beforeContentTypeCreate(input) {
    return input;
  },
  beforeEntryPublish(input) {
    return input;
  },
  afterEntryPublished() {
    return undefined;
  },
  afterMediaCreated() {
    return undefined;
  }
};
