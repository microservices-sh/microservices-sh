import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import type { BankStatementImportFieldMapping, BankStatementImportMappingPreset } from "@microservices-sh/bank-reconciliation";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const importTone = (status: string): Tone =>
  status === "completed" ? "good" : status === "failed" ? "bad" : status === "processing" ? "warn" : "neutral";

const matchTone = (status: string): Tone =>
  status === "unmatched" ? "warn" : status === "excluded" ? "neutral" : "good";

const amountTone = (amountCents: number): Tone => (amountCents >= 0 ? "good" : "bad");

function shortDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "-";
}

function mappingSummary(mapping: BankStatementImportFieldMapping | undefined, presets: BankStatementImportMappingPreset[]): string[] {
  if (!mapping) return [];
  const preset = mapping.presetId ? presets.find((candidate) => candidate.id === mapping.presetId) : null;
  return [
    preset ? `Preset: ${preset.label}` : mapping.presetId ? `Preset: ${mapping.presetId}` : null,
    `Date: ${mapping.date}`,
    `Description: ${mapping.description}`,
    mapping.amount ? `Amount: ${mapping.amount}` : `Debit: ${mapping.debit ?? "-"}`,
    mapping.amount ? null : `Credit: ${mapping.credit ?? "-"}`
  ].filter((value): value is string => Boolean(value));
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
  const importGroups = await Promise.all(
    accounts.map(async (account) => ({
      account,
      result: await service.listStatementImports(ctx, account.id)
    }))
  );
  const failedImportGroup = importGroups.find(({ result }) => !result.ok);
  if (failedImportGroup) {
    throw error(500, failedImportGroup.result.error?.message ?? "Could not load statement imports.");
  }

  const statementImport = importGroups.flatMap(({ result }) => result.data ?? []).find((candidate) => candidate.id === params.id);
  if (!statementImport) throw error(404, "Statement import not found");

  const [transactionsResult, reconciliationsResult] = await Promise.all([
    service.listStatementTransactions(ctx, statementImport.bankAccountId),
    service.listReconciliations(ctx, statementImport.bankAccountId)
  ]);
  const presetsResult = await service.listStatementImportFieldMappingPresets();
  if (!transactionsResult.ok) {
    throw error(500, transactionsResult.error?.message ?? "Could not load statement transactions.");
  }

  const account = accounts.find((candidate) => candidate.id === statementImport.bankAccountId) ?? null;
  const currency = account?.currency ?? "USD";
  const transactions = (transactionsResult.data ?? []).filter(
    (transaction) =>
      transaction.statementImportId === statementImport.id &&
      transaction.bankAccountId === statementImport.bankAccountId &&
      transaction.tenantId === activeOrgId
  );
  const depositsCents = transactions.filter((transaction) => transaction.amountCents > 0).reduce((total, transaction) => total + transaction.amountCents, 0);
  const withdrawalsCents = transactions
    .filter((transaction) => transaction.amountCents < 0)
    .reduce((total, transaction) => total + Math.abs(transaction.amountCents), 0);
  const unmatchedCount = transactions.filter((transaction) => transaction.matchStatus === "unmatched").length;
  const reconciledCount = transactions.filter((transaction) => transaction.reconciled).length;
  const importCreatedAt = statementImport.importedAt ?? statementImport.createdAt;
  const reconciliations = reconciliationsResult.ok ? reconciliationsResult.data ?? [] : [];

  return {
    statementImport: {
      ...statementImport,
      title: statementImport.fileName ?? `${statementImport.source.toUpperCase()} import`,
      tone: importTone(statementImport.status),
      sourceLabel: statementImport.source.toUpperCase(),
      created: relativeTime(importCreatedAt),
      importedAtShort: shortDate(statementImport.importedAt),
      startDateShort: shortDate(statementImport.startDate),
      endDateShort: shortDate(statementImport.endDate),
      mapping: mappingSummary(statementImport.fieldMapping, presetsResult.ok ? presetsResult.data ?? [] : [])
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
      importedRows: statementImport.importedRows,
      duplicateRows: statementImport.duplicateRows,
      skippedRows: statementImport.skippedRows,
      totalRows: statementImport.totalRows,
      deposits: money(depositsCents, currency),
      withdrawals: money(withdrawalsCents, currency),
      net: money(depositsCents - withdrawalsCents, currency),
      unmatchedCount,
      reconciledCount
    },
    transactions: transactions.map((transaction) => ({
      ...transaction,
      amount: money(transaction.amountCents, currency),
      amountTone: amountTone(transaction.amountCents),
      matchTone: matchTone(transaction.matchStatus),
      reconciledAtShort: shortDate(transaction.reconciledAt),
      created: relativeTime(transaction.createdAt)
    })),
    reconciliations: reconciliations
      .slice()
      .sort((left, right) => right.statementDate.localeCompare(left.statementDate))
      .slice(0, 4)
      .map((session) => ({
        id: session.id,
        status: session.status,
        statementDate: session.statementDate,
        statementBalance: money(session.statementBalanceCents, currency),
        difference: money(session.differenceCents ?? 0, currency),
        tone: session.status === "completed" ? "good" : session.status === "in_progress" ? "warn" : "neutral"
      }))
  };
};
