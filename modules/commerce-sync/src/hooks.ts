export interface CommerceSyncHooks {
  beforeCommerceSyncCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterCommerceSyncUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultCommerceSyncHooks: Required<CommerceSyncHooks> = {
  beforeCommerceSyncCreate(input) {
    return input;
  },
  afterCommerceSyncUpdated() {
    return undefined;
  }
};
