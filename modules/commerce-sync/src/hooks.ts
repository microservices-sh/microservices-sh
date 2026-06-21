export interface CommerceSyncHooks {
  beforeCommerceConnectionCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeCommerceSyncRun?: (input: unknown) => Promise<unknown> | unknown;
  beforeCommerceWebhookRecord?: (input: unknown) => Promise<unknown> | unknown;
  afterCommercePayloadNormalized?: (record: unknown) => Promise<void> | void;
}

export const defaultCommerceSyncHooks: Required<CommerceSyncHooks> = {
  beforeCommerceConnectionCreate(input) {
    return input;
  },
  beforeCommerceSyncRun(input) {
    return input;
  },
  beforeCommerceWebhookRecord(input) {
    return input;
  },
  afterCommercePayloadNormalized() {
    return undefined;
  }
};
