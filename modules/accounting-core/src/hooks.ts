import type { JournalEntryWithLines } from "./types";

export interface AccountingCoreHooks {
  beforeAccountCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeFiscalPeriodCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeJournalEntryCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeJournalEntryPost?: (input: unknown) => Promise<unknown> | unknown;
  beforeJournalEntryVoid?: (input: unknown) => Promise<unknown> | unknown;
  afterJournalEntryChanged?: (entry: JournalEntryWithLines) => Promise<void> | void;
}

export const defaultAccountingCoreHooks: Required<AccountingCoreHooks> = {
  beforeAccountCreate(input) {
    return input;
  },
  beforeFiscalPeriodCreate(input) {
    return input;
  },
  beforeJournalEntryCreate(input) {
    return input;
  },
  beforeJournalEntryPost(input) {
    return input;
  },
  beforeJournalEntryVoid(input) {
    return input;
  },
  afterJournalEntryChanged() {
    return undefined;
  }
};
