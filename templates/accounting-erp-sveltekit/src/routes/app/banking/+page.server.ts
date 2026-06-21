import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { createBankReconciliationMemoryService, getBankReconciliationModuleStatus } from "@microservices-sh/bank-reconciliation";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("bank-reconciliation", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = createBankReconciliationMemoryService();
  const ctx = { tenantId: activeOrgId, now: "2026-06-21T00:00:00.000Z" };
  const account = service.createBankAccount(ctx, {
    name: "Operating checking",
    bankName: "Demo Bank",
    openingBalanceCents: 250000
  });
  const imported = account.ok
    ? service.importStatementTransactions(ctx, account.data.id, [
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
  const reconciliation = account.ok
    ? service.startReconciliation(ctx, account.data.id, "2026-06-30", 321500)
    : null;
  const accounts = service.listBankAccounts(ctx);
  const transactions = account.ok ? service.listStatementTransactions(ctx, account.data.id) : null;

  return {
    status: getBankReconciliationModuleStatus(),
    accounts: accounts.ok ? accounts.data : [],
    transactions: transactions?.ok ? transactions.data : [],
    imported: imported?.ok ? imported.data : null,
    reconciliation: reconciliation?.ok ? reconciliation.data : null
  };
};
