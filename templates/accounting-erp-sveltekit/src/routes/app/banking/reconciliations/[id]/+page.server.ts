import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import type { BankTransaction, ReconciliationSession } from "@microservices-sh/bank-reconciliation";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone =>
  status === "completed" ? "good" : status === "in_progress" ? "warn" : status === "abandoned" ? "bad" : "neutral";

const matchTone = (status: string): Tone =>
  status === "unmatched" ? "warn" : status === "excluded" ? "neutral" : "good";

const amountTone = (amountCents: number): Tone => (amountCents >= 0 ? "good" : "bad");

function shortDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "-";
}

function belongsToReconciliation(transaction: BankTransaction, reconciliation: ReconciliationSession, activeOrgId: string): boolean {
  if (transaction.bankAccountId !== reconciliation.bankAccountId) return false;
  if (transaction.tenantId !== activeOrgId) return false;
  if (reconciliation.status === "completed") return transaction.reconciliationId === reconciliation.id && transaction.reconciled === true;
  if (reconciliation.status !== "in_progress") return false;
  return transaction.transactionDate <= reconciliation.statementDate && !transaction.reconciled && transaction.matchStatus !== "excluded";
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("bank-reconciliation", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = locals.bankReconciliationService;
  const ctx = { tenantId: activeOrgId, actorId: locals.user.id };
  const accountsResult = await service.listBankAccounts(ctx);
  if (!accountsResult.ok) throw error(500, accountsResult.error?.message ?? "Could not load bank accounts.");

  const accounts = accountsResult.data ?? [];
  const reconciliationGroups = await Promise.all(
    accounts.map(async (account) => ({
      account,
      result: await service.listReconciliations(ctx, account.id)
    }))
  );
  const failedGroup = reconciliationGroups.find(({ result }) => !result.ok);
  if (failedGroup) throw error(500, failedGroup.result.error?.message ?? "Could not load reconciliations.");

  const reconciliation = reconciliationGroups.flatMap(({ result }) => result.data ?? []).find((session) => session.id === params.id);
  if (!reconciliation) throw error(404, "Reconciliation not found");

  const [transactionsResult, importsResult] = await Promise.all([
    service.listStatementTransactions(ctx, reconciliation.bankAccountId),
    service.listStatementImports(ctx, reconciliation.bankAccountId)
  ]);
  if (!transactionsResult.ok) throw error(500, transactionsResult.error?.message ?? "Could not load statement transactions.");

  const account = accounts.find((candidate) => candidate.id === reconciliation.bankAccountId) ?? null;
  const currency = account?.currency ?? "USD";
  const importsById = new Map((importsResult.ok ? importsResult.data ?? [] : []).map((statementImport) => [statementImport.id, statementImport]));
  const transactions = (transactionsResult.data ?? []).filter((transaction) =>
    belongsToReconciliation(transaction, reconciliation, activeOrgId)
  );
  const depositsCents = transactions.filter((transaction) => transaction.amountCents > 0).reduce((total, transaction) => total + transaction.amountCents, 0);
  const withdrawalsCents = transactions
    .filter((transaction) => transaction.amountCents < 0)
    .reduce((total, transaction) => total + Math.abs(transaction.amountCents), 0);
  const unmatchedCount = transactions.filter((transaction) => transaction.matchStatus === "unmatched").length;
  const clearedCount = transactions.filter((transaction) => transaction.cleared || transaction.reconciled).length;
  const matchedCount = transactions.length - unmatchedCount;

  return {
    reconciliation: {
      ...reconciliation,
      tone: statusTone(reconciliation.status),
      title: `${shortDate(reconciliation.statementDate)} reconciliation`,
      statementBalance: money(reconciliation.statementBalanceCents, currency),
      openingBalance: money(reconciliation.openingBalanceCents ?? 0, currency),
      clearedDeposits: money(reconciliation.clearedDepositsCents ?? depositsCents, currency),
      clearedWithdrawals: money(reconciliation.clearedWithdrawalsCents ?? withdrawalsCents, currency),
      clearedBalance: money(reconciliation.clearedBalanceCents ?? (account?.openingBalanceCents ?? 0) + depositsCents - withdrawalsCents, currency),
      difference: money(reconciliation.differenceCents ?? reconciliation.statementBalanceCents - ((account?.openingBalanceCents ?? 0) + depositsCents - withdrawalsCents), currency),
      created: relativeTime(reconciliation.createdAt),
      changed: relativeTime(reconciliation.updatedAt ?? reconciliation.completedAt ?? reconciliation.createdAt),
      completedAtShort: shortDate(reconciliation.completedAt),
      periodStartShort: shortDate(reconciliation.periodStart),
      periodEndShort: shortDate(reconciliation.periodEnd)
    },
    account: account
      ? {
          id: account.id,
          name: account.name,
          bankName: account.bankName ?? "Unspecified bank",
          currency: account.currency,
          openingBalance: money(account.openingBalanceCents, account.currency)
        }
      : null,
    summary: {
      transactionCount: transactions.length,
      matchedCount,
      unmatchedCount,
      clearedCount,
      deposits: money(depositsCents, currency),
      withdrawals: money(withdrawalsCents, currency),
      net: money(depositsCents - withdrawalsCents, currency)
    },
    transactions: transactions.map((transaction) => {
      const statementImport = transaction.statementImportId ? importsById.get(transaction.statementImportId) : null;
      return {
        ...transaction,
        amount: money(transaction.amountCents, currency),
        amountTone: amountTone(transaction.amountCents),
        matchTone: matchTone(transaction.matchStatus),
        clearTone: transaction.cleared || transaction.reconciled ? "good" : "neutral",
        clearStatus: transaction.reconciled ? "reconciled" : transaction.cleared ? "cleared" : "uncleared",
        importTitle: statementImport?.fileName ?? statementImport?.source.toUpperCase() ?? null,
        clearedAtShort: shortDate(transaction.clearedAt),
        reconciledAtShort: shortDate(transaction.reconciledAt)
      };
    }),
    imports: [...importsById.values()]
      .filter((statementImport) => transactions.some((transaction) => transaction.statementImportId === statementImport.id))
      .map((statementImport) => ({
        id: statementImport.id,
        title: statementImport.fileName ?? statementImport.source.toUpperCase(),
        status: statementImport.status,
        importedRows: statementImport.importedRows,
        duplicateRows: statementImport.duplicateRows,
        tone: statementImport.status === "completed" ? "good" : statementImport.status === "failed" ? "bad" : "warn"
      }))
  };
};
