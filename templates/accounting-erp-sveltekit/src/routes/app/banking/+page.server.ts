import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { getBankReconciliationModuleStatus } from "@microservices-sh/bank-reconciliation";
import type { BankTransaction, MatchCandidate } from "@microservices-sh/bank-reconciliation";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function moneyToCents(value: string, fallback = 0): number | null {
  if (!value) return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function dateOnly(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function integer(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function targetType(value: string): MatchCandidate["targetType"] | null {
  return ["ledger_entry", "ledger_line", "payment", "external_ref"].includes(value) ? (value as MatchCandidate["targetType"]) : null;
}

function localCandidates(transaction: BankTransaction): MatchCandidate[] {
  const description = transaction.description.toLowerCase();
  if (description.includes("stripe")) {
    return [
      {
        targetType: "ledger_line",
        targetId: "demo-ledger-line-stripe-payout",
        targetRef: "JE-DEMO-STRIPE",
        targetDate: transaction.transactionDate,
        amountCents: transaction.amountCents,
        description: "Stripe payout clearing entry",
        source: "demo-ledger"
      }
    ];
  }
  if (description.includes("cloud hosting")) {
    return [
      {
        targetType: "ledger_line",
        targetId: "demo-ledger-line-cloud-hosting",
        targetRef: "JE-DEMO-CLOUD",
        targetDate: transaction.transactionDate,
        amountCents: transaction.amountCents,
        description: "Cloud hosting expense entry",
        source: "demo-ledger"
      }
    ];
  }
  return [];
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("bank-reconciliation", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = locals.bankReconciliationService;
  const ctx = { tenantId: activeOrgId, now: "2026-06-21T00:00:00.000Z" };
  const seedDemoData = !platform?.env?.DB;
  const existingAccounts = await service.listBankAccounts(ctx);
  const existingAccount = existingAccounts.ok
    ? (existingAccounts.data ?? []).find((candidate) => candidate.name === "Operating checking")
    : undefined;
  let bankAccount = existingAccount ?? (existingAccounts.ok ? (existingAccounts.data ?? [])[0] : null) ?? null;
  let imported: Awaited<ReturnType<typeof service.importStatementCsv>> | null = null;

  if (seedDemoData) {
    if (!bankAccount) {
      const account = await service.createBankAccount(ctx, {
        name: "Operating checking",
        bankName: "Demo Bank",
        openingBalanceCents: 250000
      });
      bankAccount = account.ok && account.data ? account.data : null;
    }
    const existingTransactions = bankAccount ? await service.listStatementTransactions(ctx, bankAccount.id) : null;
    imported =
      bankAccount && existingTransactions?.ok && existingTransactions.data.length === 0
        ? await service.importStatementCsv(ctx, bankAccount.id, {
            fileName: "operating-demo.csv",
            fieldMapping: { date: "Date", description: "Description", amount: "Amount" },
            csvContent: ["Date,Description,Amount", "2026-06-18,Stripe payout,840.00", "2026-06-19,Cloud hosting,-125.00"].join(
              "\n"
            )
          })
        : null;
  }
  const accounts = await service.listBankAccounts(ctx);
  const transactions = bankAccount ? await service.listStatementTransactions(ctx, bankAccount.id) : null;
  const statementImports = bankAccount ? await service.listStatementImports(ctx, bankAccount.id) : null;
  const reconciliations = bankAccount ? await service.listReconciliations(ctx, bankAccount.id) : null;
  const transactionRows = transactions?.ok ? transactions.data : [];
  const matchSuggestions = await Promise.all(
    transactionRows
      .filter((transaction) => transaction.matchStatus === "unmatched" && !transaction.reconciled)
      .map(async (transaction) => {
        const suggested = await service.suggestMatches(ctx, {
          transactionId: transaction.id,
          candidates: localCandidates(transaction),
          amountToleranceCents: 0,
          dateToleranceDays: 3,
          limit: 3
        });
        return { transactionId: transaction.id, suggestions: suggested.ok ? suggested.data : [] };
      })
  );

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    status: getBankReconciliationModuleStatus(),
    accounts: accounts.ok ? accounts.data : [],
    transactions: transactionRows,
    matchSuggestions,
    statementImports: statementImports?.ok ? statementImports.data : [],
    reconciliations: reconciliations?.ok ? reconciliations.data : [],
    imported: imported?.ok ? imported.data : null,
    reconciliation: reconciliations?.ok ? (reconciliations.data[0] ?? null) : null
  };
};

export const actions: Actions = {
  createAccount: async ({ request, locals, cookies, platform }) => {
    requireModule("bank-reconciliation", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      name: text(form.get("name")),
      bankName: text(form.get("bankName")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      openingBalance: text(form.get("openingBalance"))
    };
    const openingBalanceCents = moneyToCents(values.openingBalance);
    if (!values.name || openingBalanceCents == null) {
      return fail(400, { error: "Enter an account name and a valid opening balance.", values });
    }

    const account = await locals.bankReconciliationService.createBankAccount(
      { tenantId: org.id, actorId: locals.user.id },
      {
        name: values.name,
        bankName: values.bankName || undefined,
        currency: values.currency,
        openingBalanceCents
      }
    );
    if (!account.ok || !account.data) return fail(400, { error: account.error?.message ?? "Could not create bank account.", values });

    await recordEvent(
      {
        eventName: "bank-reconciliation.bank_account_created",
        actorId: locals.user.id,
        entityType: "bank_account",
        entityId: account.data.id,
        source: "app/banking",
        payload: { name: account.data.name, bankName: account.data.bankName ?? null, currency: account.data.currency }
      },
      { auditStore: locals.auditStore }
    );

    return { accountCreated: true };
  },

  importCsv: async ({ request, locals, cookies, platform }) => {
    requireModule("bank-reconciliation", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      bankAccountId: text(form.get("bankAccountId")),
      fileName: text(form.get("fileName")) || "statement.csv",
      dateField: text(form.get("dateField")) || "Date",
      descriptionField: text(form.get("descriptionField")) || "Description",
      amountField: text(form.get("amountField")),
      debitField: text(form.get("debitField")),
      creditField: text(form.get("creditField")),
      csvContent: text(form.get("csvContent"))
    };
    const fieldMapping =
      values.amountField.length > 0
        ? { date: values.dateField, description: values.descriptionField, amount: values.amountField }
        : { date: values.dateField, description: values.descriptionField, debit: values.debitField, credit: values.creditField };
    if (!values.bankAccountId || !values.csvContent || (!values.amountField && (!values.debitField || !values.creditField))) {
      return fail(400, { error: "Choose an account, paste CSV rows, and map amount or debit/credit fields.", values });
    }

    const imported = await locals.bankReconciliationService.importStatementCsv(
      { tenantId: org.id, actorId: locals.user.id },
      values.bankAccountId,
      {
        fileName: values.fileName,
        importedById: locals.user.id,
        fieldMapping,
        csvContent: values.csvContent
      }
    );
    if (!imported.ok || !imported.data) return fail(400, { error: imported.error?.message ?? "Could not import statement CSV.", values });

    await recordEvent(
      {
        eventName: "bank-reconciliation.statement_imported",
        actorId: locals.user.id,
        entityType: "bank_statement_import",
        entityId: imported.data.statementImport?.id ?? values.fileName,
        source: "app/banking",
        payload: {
          bankAccountId: values.bankAccountId,
          importedCount: imported.data.importedCount,
          skippedDuplicateCount: imported.data.skippedDuplicateCount
        }
      },
      { auditStore: locals.auditStore }
    );

    return { csvImported: true, importedCount: imported.data.importedCount, skippedDuplicateCount: imported.data.skippedDuplicateCount };
  },

  matchTransaction: async ({ request, locals, cookies, platform }) => {
    requireModule("bank-reconciliation", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      transactionId: text(form.get("transactionId")),
      ledgerReferenceId: text(form.get("ledgerReferenceId")),
      targetType: text(form.get("targetType")),
      targetId: text(form.get("targetId")),
      targetRef: text(form.get("targetRef")),
      targetDate: text(form.get("targetDate")),
      targetAmountCents: text(form.get("targetAmountCents")),
      description: text(form.get("description")),
      confidence: text(form.get("confidence"))
    };
    const selectedTargetType = targetType(values.targetType);
    const targetAmountCents = integer(values.targetAmountCents);
    const confidence = values.confidence ? integer(values.confidence) : null;
    const hasCandidate = Boolean(selectedTargetType && values.targetId && targetAmountCents != null);
    if (!values.transactionId || (!hasCandidate && !values.ledgerReferenceId)) {
      return fail(400, { error: "Choose a transaction and select a match candidate or enter a ledger reference.", values });
    }

    const ctx = { tenantId: org.id, actorId: locals.user.id };
    const matched = hasCandidate
      ? await locals.bankReconciliationService.createMatch(ctx, {
          transactionId: values.transactionId,
          targetType: selectedTargetType!,
          targetId: values.targetId,
          targetRef: values.targetRef || null,
          targetDate: dateOnly(values.targetDate) ?? null,
          targetAmountCents: targetAmountCents!,
          description: values.description || null,
          matchType: "manual",
          confidence
        })
      : await locals.bankReconciliationService.matchTransaction(ctx, values.transactionId, values.ledgerReferenceId);
    if (!matched.ok || !matched.data) return fail(400, { error: matched.error?.message ?? "Could not match transaction.", values });

    const transaction = "transaction" in matched.data ? matched.data.transaction : matched.data;
    const match = "match" in matched.data ? matched.data.match : null;

    await recordEvent(
      {
        eventName: "bank-reconciliation.match_created",
        actorId: locals.user.id,
        entityType: "bank_transaction",
        entityId: transaction.id,
        source: "app/banking",
        payload: {
          ledgerReferenceId: transaction.ledgerReferenceId,
          amountCents: transaction.amountCents,
          targetType: match?.targetType ?? "ledger_line",
          targetId: match?.targetId ?? values.ledgerReferenceId,
          matchId: match?.id ?? null,
          confidence: match?.confidence ?? null
        }
      },
      { auditStore: locals.auditStore }
    );

    return { transactionMatched: true };
  },

  startReconciliation: async ({ request, locals, cookies, platform }) => {
    requireModule("bank-reconciliation", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      bankAccountId: text(form.get("bankAccountId")),
      statementDate: text(form.get("statementDate")),
      statementBalance: text(form.get("statementBalance"))
    };
    const statementDate = dateOnly(values.statementDate);
    const statementBalanceCents = moneyToCents(values.statementBalance, Number.NaN);
    if (!values.bankAccountId || !statementDate || statementBalanceCents == null || Number.isNaN(statementBalanceCents)) {
      return fail(400, { error: "Choose an account, statement date, and statement balance.", values });
    }

    const reconciliation = await locals.bankReconciliationService.startReconciliation(
      { tenantId: org.id, actorId: locals.user.id },
      values.bankAccountId,
      statementDate,
      statementBalanceCents
    );
    if (!reconciliation.ok || !reconciliation.data) {
      return fail(400, { error: reconciliation.error?.message ?? "Could not start reconciliation.", values });
    }

    await recordEvent(
      {
        eventName: "bank-reconciliation.reconciliation_started",
        actorId: locals.user.id,
        entityType: "bank_reconciliation",
        entityId: reconciliation.data.id,
        source: "app/banking",
        payload: { bankAccountId: values.bankAccountId, statementDate, statementBalanceCents }
      },
      { auditStore: locals.auditStore }
    );

    return { reconciliationStarted: true, reconciliation: reconciliation.data };
  },

  completeReconciliation: async ({ request, locals, cookies, platform }) => {
    requireModule("bank-reconciliation", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      reconciliationId: text(form.get("reconciliationId"))
    };
    if (!values.reconciliationId) {
      return fail(400, { error: "Choose a reconciliation session.", values });
    }

    const completed = await locals.bankReconciliationService.completeReconciliation(
      { tenantId: org.id, actorId: locals.user.id },
      values.reconciliationId
    );
    if (!completed.ok || !completed.data) {
      return fail(400, { error: completed.error?.message ?? "Could not complete reconciliation.", values });
    }

    await recordEvent(
      {
        eventName: "bank-reconciliation.reconciliation_completed",
        actorId: locals.user.id,
        entityType: "bank_reconciliation",
        entityId: completed.data.id,
        source: "app/banking",
        payload: {
          bankAccountId: completed.data.bankAccountId,
          statementDate: completed.data.statementDate,
          statementBalanceCents: completed.data.statementBalanceCents,
          transactionsCleared: completed.data.transactionsCleared ?? 0
        }
      },
      { auditStore: locals.auditStore }
    );

    return { reconciliationCompleted: true, reconciliation: completed.data };
  }
};
