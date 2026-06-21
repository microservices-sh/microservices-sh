import {
  createJournalEntry,
  postJournalEntry,
  type AccountingCoreStore,
  type Actor
} from "@microservices-sh/accounting-core";
import type { Invoice } from "@microservices-sh/invoice";
import type {
  AccountsReceivableAccountingPoster,
  AccountsReceivablePaymentPostRequest,
  AccountingPostResult
} from "@microservices-sh/accounts-receivable";

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function fail(message: string): never {
  throw new Error(message);
}

async function openPeriodId(accountingCoreStore: AccountingCoreStore, tenantId: string, entryDate: string): Promise<string> {
  const periods = await accountingCoreStore.listFiscalPeriods({ tenantId, status: "open", limit: 100 });
  const period = periods.find((candidate) => entryDate >= candidate.startsOn && entryDate <= candidate.endsOn);
  if (!period) fail("Create an open fiscal period covering this AR date before posting to accounting.");
  return period.id;
}

async function accountByCode(accountingCoreStore: AccountingCoreStore, tenantId: string, code: string, label: string): Promise<string> {
  const account = await accountingCoreStore.findAccountByCode(tenantId, code);
  if (!account || !account.active) fail(`Seed or activate ${label} (${code}) before posting to accounting.`);
  return account.id;
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

async function existingPostedEntry(
  accountingCoreStore: AccountingCoreStore,
  tenantId: string,
  sourceRef: string
): Promise<AccountingPostResult | null> {
  const existing = await accountingCoreStore.findPostedEntryBySourceRef(tenantId, sourceRef);
  return existing ? { journalEntryId: existing.id } : null;
}

export async function postIssuedInvoiceToAccounting(input: {
  accountingCoreStore: AccountingCoreStore;
  actor?: Actor | null;
  invoice: Invoice;
}): Promise<AccountingPostResult> {
  const { accountingCoreStore, actor = null, invoice } = input;
  if (invoice.status === "draft" || !invoice.issuedAt || invoice.totalCents <= 0) return { journalEntryId: null };

  const sourceRef = `accounts-receivable:invoice:${invoice.id}`;
  const existing = await existingPostedEntry(accountingCoreStore, invoice.tenantId, sourceRef);
  if (existing) return existing;

  const entryDate = dateOnly(invoice.issuedAt);
  const periodId = await openPeriodId(accountingCoreStore, invoice.tenantId, entryDate);
  const arAccountId = await accountByCode(accountingCoreStore, invoice.tenantId, "1200", "Accounts Receivable");
  const revenueAccountId = await accountByCode(accountingCoreStore, invoice.tenantId, "4100", "Sales Revenue");
  const invoiceNumber = invoice.number ?? invoice.id;

  const entry = await createJournalEntry(
    {
      tenantId: invoice.tenantId,
      periodId,
      entryDate,
      description: `Invoice ${invoiceNumber}`,
      sourceRef,
      sourceType: "accounts-receivable.invoice",
      lines: [
        {
          accountId: arAccountId,
          description: `Accounts receivable ${invoiceNumber}`,
          debitCents: invoice.totalCents,
          creditCents: 0
        },
        {
          accountId: revenueAccountId,
          description: `Sales revenue ${invoiceNumber}`,
          debitCents: 0,
          creditCents: invoice.totalCents
        }
      ]
    },
    { accountingCoreStore, actor }
  );
  const entryId = unwrapJournal(entry);
  return unwrapPosted(
    await postJournalEntry({ tenantId: invoice.tenantId, entryId, postedById: actor?.id ?? null }, { accountingCoreStore, actor })
  );
}

export function createAccountsReceivableAccountingPoster(input: {
  accountingCoreStore: AccountingCoreStore;
  actor?: Actor | null;
}): AccountsReceivableAccountingPoster {
  const { accountingCoreStore, actor = null } = input;

  return {
    async postAccountsReceivablePayment(request: AccountsReceivablePaymentPostRequest): Promise<AccountingPostResult> {
      const totalAppliedCents = request.applications.reduce((sum, application) => sum + application.amountCents, 0);
      if (request.payment.unappliedCents !== 0 || totalAppliedCents !== request.payment.amountCents) {
        fail("Apply the full customer payment before posting to accounting.");
      }

      const sourceRef = `accounts-receivable:payment:${request.payment.id}`;
      const existing = await existingPostedEntry(accountingCoreStore, request.tenantId, sourceRef);
      if (existing) return existing;

      const entryDate = dateOnly(request.payment.paymentDate);
      const periodId = await openPeriodId(accountingCoreStore, request.tenantId, entryDate);
      const arAccountId = await accountByCode(accountingCoreStore, request.tenantId, "1200", "Accounts Receivable");
      const defaultDepositAccountId = await accountByCode(accountingCoreStore, request.tenantId, "1120", "Undeposited Funds");
      const depositAccountId = ensureAccount(request.payment.depositAccountId ?? defaultDepositAccountId, "a deposit asset account");

      const creditLines = request.applications.map((application) => {
        const invoice = request.invoices.find((candidate) => candidate.id === application.invoiceId);
        return {
          accountId: arAccountId,
          description: `Payment applied to ${invoice?.invoiceNumber ?? application.invoiceId}`,
          debitCents: 0,
          creditCents: application.amountCents
        };
      });

      const entry = await createJournalEntry(
        {
          tenantId: request.tenantId,
          periodId,
          entryDate,
          description: `Customer payment ${request.payment.id}`,
          sourceRef,
          sourceType: "accounts-receivable.payment",
          lines: [
            {
              accountId: depositAccountId,
              description: `Customer payment ${request.payment.id}`,
              debitCents: request.payment.amountCents,
              creditCents: 0
            },
            ...creditLines
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
