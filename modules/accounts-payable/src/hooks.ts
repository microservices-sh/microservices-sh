import type { BillWithLineItems, Vendor } from "./types";

export interface AccountsPayableHooks {
  beforeVendorCreate(input: unknown): Promise<unknown>;
  beforeBillCreate(input: unknown): Promise<unknown>;
  beforeBillMarkPayable(bill: BillWithLineItems): Promise<BillWithLineItems | null>;
  beforeBillVoid(bill: BillWithLineItems): Promise<BillWithLineItems | null>;
  afterBillPayable(bill: BillWithLineItems): Promise<void>;
  afterBillPaymentRecorded(bill: BillWithLineItems): Promise<void>;
  afterBillVoided(bill: BillWithLineItems): Promise<void>;
  afterVendorCreated(vendor: Vendor): Promise<void>;
}

export const defaultAccountsPayableHooks: AccountsPayableHooks = {
  async beforeVendorCreate(input) {
    return input;
  },
  async beforeBillCreate(input) {
    return input;
  },
  async beforeBillMarkPayable(bill) {
    return bill;
  },
  async beforeBillVoid(bill) {
    return bill;
  },
  async afterBillPayable() {
    return;
  },
  async afterBillPaymentRecorded() {
    return;
  },
  async afterBillVoided() {
    return;
  },
  async afterVendorCreated() {
    return;
  }
};

export async function beforeVendorCreate(input: unknown): Promise<unknown> {
  return defaultAccountsPayableHooks.beforeVendorCreate(input);
}

export async function beforeBillCreate(input: unknown): Promise<unknown> {
  return defaultAccountsPayableHooks.beforeBillCreate(input);
}

export async function beforeBillMarkPayable(bill: BillWithLineItems): Promise<BillWithLineItems | null> {
  return defaultAccountsPayableHooks.beforeBillMarkPayable(bill);
}

export async function beforeBillVoid(bill: BillWithLineItems): Promise<BillWithLineItems | null> {
  return defaultAccountsPayableHooks.beforeBillVoid(bill);
}

export async function afterBillPayable(bill: BillWithLineItems): Promise<void> {
  return defaultAccountsPayableHooks.afterBillPayable(bill);
}

export async function afterBillPaymentRecorded(bill: BillWithLineItems): Promise<void> {
  return defaultAccountsPayableHooks.afterBillPaymentRecorded(bill);
}

export async function afterBillVoided(bill: BillWithLineItems): Promise<void> {
  return defaultAccountsPayableHooks.afterBillVoided(bill);
}

export async function afterVendorCreated(vendor: Vendor): Promise<void> {
  return defaultAccountsPayableHooks.afterVendorCreated(vendor);
}
