import { accountInputSchema } from "../schemas";
import { accountingId, isoNow, normalBalanceForType, normalizeAccountCode, normalizeOptional } from "../service";
import type { Account, Actor } from "../types";
import { err, hooks, ok, type AccountingDeps } from "./shared";

export async function createAccount(input: unknown, deps: AccountingDeps & { actor?: Actor | null }) {
  const filtered = await hooks(deps).beforeAccountCreate(input);
  const parsed = accountInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_ACCOUNT_INPUT", "Account input is invalid.", parsed.error.issues);
  }

  const code = normalizeAccountCode(parsed.data.code);
  const existing = await deps.accountingCoreStore.findAccountByCode(parsed.data.tenantId, code);
  if (existing) {
    return err(409, "accounting-core.ACCOUNT_CODE_CONFLICT", `An account already uses code ${code}.`);
  }

  const now = isoNow(deps.now);
  const account: Account = {
    id: accountingId("acct"),
    tenantId: parsed.data.tenantId,
    code,
    name: parsed.data.name.trim(),
    type: parsed.data.type,
    subtype: parsed.data.subtype ?? null,
    parentId: normalizeOptional(parsed.data.parentId),
    currency: parsed.data.currency.trim().toUpperCase(),
    normalBalance: parsed.data.normalBalance ?? normalBalanceForType(parsed.data.type),
    description: normalizeOptional(parsed.data.description),
    isSystem: parsed.data.isSystem,
    isReconcilable: parsed.data.isReconcilable,
    isHeader: parsed.data.isHeader,
    active: parsed.data.active,
    createdAt: now,
    updatedAt: now
  };

  await deps.accountingCoreStore.insertAccount(account);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.account_created",
    entityType: "account",
    entityId: account.id,
    tenantId: account.tenantId,
    payload: { actorId: deps.actor?.id ?? null, code: account.code, type: account.type, subtype: account.subtype }
  });

  return ok(201, { account });
}
