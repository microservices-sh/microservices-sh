import type { CreateEstimateQuoteInput, EstimateQuote, UpdateEstimateQuoteInput } from "./types";

export interface EstimateQuoteHooks {
  beforeEstimateQuoteCreate?: (input: CreateEstimateQuoteInput) => Promise<CreateEstimateQuoteInput> | CreateEstimateQuoteInput;
  beforeEstimateQuoteUpdate?: (input: UpdateEstimateQuoteInput) => Promise<UpdateEstimateQuoteInput> | UpdateEstimateQuoteInput;
  afterEstimateQuoteUpdated?: (record: EstimateQuote) => Promise<void> | void;
}

export const defaultEstimateQuoteHooks: Required<EstimateQuoteHooks> = {
  beforeEstimateQuoteCreate(input) {
    return input;
  },
  beforeEstimateQuoteUpdate(input) {
    return input;
  },
  afterEstimateQuoteUpdated() {
    return undefined;
  }
};
