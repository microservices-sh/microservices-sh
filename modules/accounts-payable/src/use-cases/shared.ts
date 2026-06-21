import { err as envelopeErr, ok as envelopeOk } from "@microservices-sh/connection-contract";
import { defaultAccountsPayableHooks, type AccountsPayableHooks } from "../hooks";
import { accountsPayableMeta } from "../meta";
import type { AccountingPoster, AccountsPayableStore } from "../ports";
import type { AccountsPayableResult, Actor } from "../types";

export interface AccountsPayableDeps {
  accountsPayableStore: AccountsPayableStore;
  accountingPoster?: AccountingPoster;
  hooks?: Partial<AccountsPayableHooks>;
  actor?: Actor | null;
  correlationId?: string;
  now?: () => number;
}

export function hooks(deps: AccountsPayableDeps): AccountsPayableHooks {
  return { ...defaultAccountsPayableHooks, ...(deps.hooks ?? {}) };
}

export function ok<T>(status: number, data: T, deps: AccountsPayableDeps): AccountsPayableResult<T> {
  return envelopeOk(status, data, accountsPayableMeta(deps));
}

export function err<T = never>(
  status: number,
  code: string,
  message: string,
  deps: AccountsPayableDeps,
  issues?: unknown[]
): AccountsPayableResult<T> {
  return envelopeErr(status, { code, message, issues }, accountsPayableMeta(deps));
}

export function validateExternalPair(
  externalSource: string | null,
  externalId: string | null,
  deps: AccountsPayableDeps
): AccountsPayableResult<never> | null {
  if ((externalSource && !externalId) || (externalId && !externalSource)) {
    return err(400, "accounts-payable.INVALID_EXTERNAL_REF", "externalSource and externalId must be supplied together.", deps);
  }
  return null;
}
