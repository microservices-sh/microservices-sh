export interface SupportInboxHooks {
  beforeSupportInboxCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterSupportInboxUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultSupportInboxHooks: Required<SupportInboxHooks> = {
  beforeSupportInboxCreate(input) {
    return input;
  },
  afterSupportInboxUpdated() {
    return undefined;
  }
};
