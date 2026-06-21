export interface MembershipCreditsHooks {
  beforeMembershipCreditsCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterMembershipCreditsUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultMembershipCreditsHooks: Required<MembershipCreditsHooks> = {
  beforeMembershipCreditsCreate(input) {
    return input;
  },
  afterMembershipCreditsUpdated() {
    return undefined;
  }
};
