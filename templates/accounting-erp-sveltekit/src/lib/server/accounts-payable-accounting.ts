import {
  createJournalEntry,
  postJournalEntry,
  type AccountingCoreStore,
  type Actor
} from "@microservices-sh/accounting-core";
import type {
  AccountingBillPaymentPostRequest,
  AccountingBillPostRequest,
  AccountingPostResult,
  AccountingPoster
} from "@microservices-sh/accounts-payable";

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function fail(message: string): never {
  throw new Error(message);
}

async function openPeriodId(accountingCoreStore: AccountingCoreStore, tenantId: string, entryDate: string): Promise<string> {
  const periods = await accountingCoreStore.listFiscalPeriods({ tenantId, status: "open", limit: 100 });
  const period = periods.find((candidate) => entryDate >= candidate.startsOn && entryDate <= candidate.endsOn);
  if (!period) fail("Create an open fiscal period covering this AP date before posting to accounting.");
  return period.id;
}

function ensureAccount(accountId: string | null | undefined, label: string): string {
  return accountId ?? fail(`Select ${label} before posting to accounting.`);
}

function unwrapJournal(result: Awaited<ReturnType<typeof createJournalEntry>>): string {
  if (!result.ok) fail(result.error.message);
  return result.data.entry.id;
}

function unwrapPosted(result: Awaited<ReturnType<typeof postJournalEntry>>): AccountingPostResult {
  if (!result.ok) fail(result.error.message);
  return { journalEntryId: result.data.entry.id };
}

export function createAccountsPayableAccountingPoster(input: {
  accountingCoreStore: AccountingCoreStore;
  actor?: Actor | null;
}): AccountingPoster {
  const { accountingCoreStore, actor = null } = input;

  return {
    async postAccountsPayableBill(request: AccountingBillPostRequest): Promise<AccountingPostResult> {
      const entryDate = dateOnly(request.bill.billDate);
      const periodId = await openPeriodId(accountingCoreStore, request.tenantId, entryDate);
      const apAccountId = ensureAccount(request.apAccountId, "an Accounts Payable liability account");
      const entry = await createJournalEntry(
        {
          tenantId: request.tenantId,
          periodId,
          entryDate,
          description: `Bill ${request.bill.billNumber}`,
          sourceRef: `accounts-payable:bill:${request.bill.id}`,
          sourceType: "accounts-payable.bill",
          lines: [
            ...request.bill.lineItems.map((line) => ({
              accountId: ensureAccount(line.expenseAccountId, "an expense account for every bill line"),
              description: line.description,
              debitCents: line.totalCents,
              creditCents: 0
            })),
            {
              accountId: apAccountId,
              description: `Accounts payable ${request.bill.billNumber}`,
              debitCents: 0,
              creditCents: request.bill.totalCents
            }
          ]
        },
        { accountingCoreStore, actor }
      );
      const entryId = unwrapJournal(entry);
      return unwrapPosted(
        await postJournalEntry({ tenantId: request.tenantId, entryId, postedById: actor?.id ?? null }, { accountingCoreStore, actor })
      );
    },

    async postAccountsPayablePayment(request: AccountingBillPaymentPostRequest): Promise<AccountingPostResult> {
      const entryDate = dateOnly(request.payment.paymentDate);
      const periodId = await openPeriodId(accountingCoreStore, request.tenantId, entryDate);
      const paymentAccountId = ensureAccount(request.payment.paymentAccountId, "the payment asset account");
      if (request.payment.unappliedAmountCents !== 0) {
        fail("Apply the full payment before posting to accounting.");
      }

      const debitLines = request.payment.applications.map((application) => {
        const bill = request.bills.find((candidate) => candidate.id === application.billId);
        if (!bill) fail("Payment application references a missing bill.");
        return {
          accountId: ensureAccount(bill.apAccountId, "an Accounts Payable liability account on every paid bill"),
          description: `Payment applied to ${bill.billNumber}`,
          debitCents: application.amountAppliedCents,
          creditCents: 0
        };
      });

      const entry = await createJournalEntry(
        {
          tenantId: request.tenantId,
          periodId,
          entryDate,
          description: `Bill payment ${request.payment.paymentNumber}`,
          sourceRef: `accounts-payable:payment:${request.payment.id}`,
          sourceType: "accounts-payable.payment",
          lines: [
            ...debitLines,
            {
              accountId: paymentAccountId,
              description: `Bill payment ${request.payment.paymentNumber}`,
              debitCents: 0,
              creditCents: request.payment.amountCents
            }
          ]
        },
        { accountingCoreStore, actor }
      );
      const entryId = unwrapJournal(entry);
      return unwrapPosted(
        await postJournalEntry({ tenantId: request.tenantId, entryId, postedById: actor?.id ?? null }, { accountingCoreStore, actor })
      );
    }
  };
}
