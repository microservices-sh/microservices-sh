import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getBankReconciliationModuleStatus } from "@microservices-sh/bank-reconciliation";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("bank-reconciliation", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = locals.bankReconciliationService;
  const ctx = { tenantId: activeOrgId, now: "2026-06-21T00:00:00.000Z" };
  const seedDemoData = !platform?.env?.DB;
  const existingAccounts = await service.listBankAccounts(ctx);
  const existingAccount = existingAccounts.ok
    ? (existingAccounts.data ?? []).find((candidate) => candidate.name === "Operating checking")
    : undefined;
  let bankAccount = existingAccount ?? (existingAccounts.ok ? (existingAccounts.data ?? [])[0] : null) ?? null;
  let imported: Awaited<ReturnType<typeof service.importStatementTransactions>> | null = null;
  let reconciliation: Awaited<ReturnType<typeof service.startReconciliation>> | null = null;

  if (seedDemoData) {
    if (!bankAccount) {
      const account = await service.createBankAccount(ctx, {
        name: "Operating checking",
        bankName: "Demo Bank",
        openingBalanceCents: 250000
      });
      bankAccount = account.ok && account.data ? account.data : null;
    }
    imported = bankAccount
      ? await service.importStatementTransactions(ctx, bankAccount.id, [
          {
            transactionDate: "2026-06-18",
            description: "Stripe payout",
            amountCents: 84000,
            transactionHash: "stripe-payout-2026-06-18"
          },
          {
            transactionDate: "2026-06-19",
            description: "Cloud hosting",
            amountCents: -12500,
            transactionHash: "hosting-2026-06-19"
          }
        ])
      : null;
    reconciliation = bankAccount
      ? await service.startReconciliation(ctx, bankAccount.id, "2026-06-30", 321500)
      : null;
  }
  const accounts = await service.listBankAccounts(ctx);
  const transactions = bankAccount ? await service.listStatementTransactions(ctx, bankAccount.id) : null;

  return {
    status: getBankReconciliationModuleStatus(),
    accounts: accounts.ok ? accounts.data : [],
    transactions: transactions?.ok ? transactions.data : [],
    imported: imported?.ok ? imported.data : null,
    reconciliation: reconciliation?.ok ? reconciliation.data : null
  };
};
