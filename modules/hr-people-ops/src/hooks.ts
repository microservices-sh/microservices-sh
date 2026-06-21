export interface HrPeopleOpsHooks {
  beforeHrPeopleOpsCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterHrPeopleOpsUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultHrPeopleOpsHooks: Required<HrPeopleOpsHooks> = {
  beforeHrPeopleOpsCreate(input) {
    return input;
  },
  afterHrPeopleOpsUpdated() {
    return undefined;
  }
};
