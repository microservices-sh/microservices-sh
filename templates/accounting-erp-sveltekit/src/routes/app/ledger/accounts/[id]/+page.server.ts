import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getAccount, getTrialBalance, listAccounts } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const accountTone = (active: boolean): Tone => (active ? "good" : "neutral");
const balanceTone = (amountCents: number): Tone => (amountCents === 0 ? "neutral" : amountCents > 0 ? "good" : "warn");

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const deps = { accountingCoreStore: locals.accountingCoreStore };
  const [accountResult, accountsResult, trialBalanceResult] = await Promise.all([
    getAccount({ tenantId: activeOrgId, accountId: params.id }, deps),
    listAccounts({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, deps),
    getTrialBalance({ tenantId: activeOrgId, includeZero: true }, deps)
  ]);

  if (!accountResult.ok) throw error(accountResult.status, accountResult.error.message);

  const account = accountResult.data.account;
  const accounts = accountsResult.ok ? accountsResult.data.accounts : [];
  const parentAccount = account.parentId ? accounts.find((candidate) => candidate.id === account.parentId) ?? null : null;
  const children = accounts.filter((child) => child.parentId === account.id);
  const trialBalanceLine = trialBalanceResult.ok
    ? trialBalanceResult.data.trialBalance.lines.find((line) => line.accountId === account.id) ?? null
    : null;
  const balanceCents = trialBalanceLine?.balanceCents ?? 0;

  return {
    account: {
      ...account,
      tone: accountTone(account.active),
      balanceTone: balanceTone(balanceCents),
      created: relativeTime(account.createdAt),
      updated: relativeTime(account.updatedAt),
      balance: money(balanceCents, account.currency),
      debit: money(trialBalanceLine?.debitCents ?? 0, account.currency),
      credit: money(trialBalanceLine?.creditCents ?? 0, account.currency)
    },
    parent: parentAccount
      ? {
          id: parentAccount.id,
          code: parentAccount.code,
          name: parentAccount.name,
          type: parentAccount.type
        }
      : null,
    children: children.map((child) => ({
      id: child.id,
      code: child.code,
      name: child.name,
      type: child.type,
      active: child.active,
      isHeader: child.isHeader
    })),
    trialBalance: trialBalanceResult.ok
      ? {
          balanced: trialBalanceResult.data.trialBalance.balanced,
          totalDebit: money(trialBalanceResult.data.trialBalance.totalDebitCents, account.currency),
          totalCredit: money(trialBalanceResult.data.trialBalance.totalCreditCents, account.currency)
        }
      : null
  };
};
