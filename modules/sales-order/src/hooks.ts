import type { SalesOrderWithLineItems } from "./types";

export interface SalesOrderHooks {
  beforeSalesOrderCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeSalesOrderConfirm?: (input: unknown, order: SalesOrderWithLineItems) => Promise<unknown> | unknown;
  beforeSalesOrderCancel?: (input: unknown, order: SalesOrderWithLineItems) => Promise<unknown> | unknown;
  beforeSalesOrderInvoice?: (input: unknown, order: SalesOrderWithLineItems) => Promise<unknown> | unknown;
  afterSalesOrderUpdated?: (order: SalesOrderWithLineItems) => Promise<void> | void;
}

export const defaultSalesOrderHooks: Required<SalesOrderHooks> = {
  beforeSalesOrderCreate(input) {
    return input;
  },
  beforeSalesOrderConfirm(input) {
    return input;
  },
  beforeSalesOrderCancel(input) {
    return input;
  },
  beforeSalesOrderInvoice(input) {
    return input;
  },
  afterSalesOrderUpdated() {
    return undefined;
  }
};
