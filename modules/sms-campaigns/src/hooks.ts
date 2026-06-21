export interface SmsCampaignsHooks {
  beforeSmsCampaignsCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterSmsCampaignsUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultSmsCampaignsHooks: Required<SmsCampaignsHooks> = {
  beforeSmsCampaignsCreate(input) {
    return input;
  },
  afterSmsCampaignsUpdated() {
    return undefined;
  }
};
