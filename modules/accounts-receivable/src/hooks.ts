import type { CustomerPayment, PaymentApplication } from "./types";

export interface AccountsReceivableHooks {
  beforeCustomerPaymentRecord?: (input: unknown) => Promise<unknown> | unknown;
  beforePaymentApply?: (input: unknown, payment: CustomerPayment) => Promise<unknown> | unknown;
  afterCustomerPaymentRecorded?: (payment: CustomerPayment) => Promise<void> | void;
  afterPaymentApplied?: (payload: { payment: CustomerPayment; applications: PaymentApplication[] }) => Promise<void> | void;
}

export const defaultAccountsReceivableHooks: Required<AccountsReceivableHooks> = {
  beforeCustomerPaymentRecord(input) {
    return input;
  },
  beforePaymentApply(input) {
    return input;
  },
  afterCustomerPaymentRecorded() {
    return undefined;
  },
  afterPaymentApplied() {
    return undefined;
  }
};
