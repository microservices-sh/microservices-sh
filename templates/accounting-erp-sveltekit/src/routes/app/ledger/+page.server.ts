import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect, type Cookies } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import {
  closeFiscalPeriod as closeAccountingFiscalPeriod,
  createAccount,
  createFiscalPeriod,
  createJournalEntry,
  getTrialBalance,
  listAccounts,
  listFiscalPeriods,
  lockFiscalPeriod as lockAccountingFiscalPeriod,
  postJournalEntry,
  reopenFiscalPeriod as reopenAccountingFiscalPeriod,
  voidJournalEntry,
  type AccountType,
  type FiscalPeriod,
  type FiscalPeriodType
} from "@microservices-sh/accounting-core";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const PERIOD_TYPES = new Set<FiscalPeriodType>(["month", "quarter", "year", "custom"]);

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function accountType(value: string): AccountType | null {
  return ["asset", "liability", "equity", "revenue", "expense"].includes(value) ? (value as AccountType) : null;
}

function fiscalPeriodType(value: string): FiscalPeriodType | null {
  return PERIOD_TYPES.has(value as FiscalPeriodType) ? (value as FiscalPeriodType) : null;
}

function dateOnly(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function cents(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function activePeriodFor(periods: FiscalPeriod[]) {
  const currentDay = today();
  const openPeriods = periods.filter((period) => period.status === "open");
  return (
    openPeriods.find((period) => period.startsOn <= currentDay && period.endsOn >= currentDay) ??
    openPeriods[openPeriods.length - 1] ??
    periods[periods.length - 1] ??
    null
  );
}

async function requireManageContext(locals: App.Locals, cookies: Cookies, platform: App.Platform | undefined) {
  requireModule("accounting-core", platform);
  if (!locals.user) return null;
  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  if (!org) return null;
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
  return {
    org,
    permissions,
    actor: { id: locals.user.id, email: locals.user.email, permissions }
  };
}

type FiscalPeriodTransition = typeof closeAccountingFiscalPeriod;

async function changeFiscalPeriodStatus(
  request: Request,
  locals: App.Locals,
  cookies: Cookies,
  platform: App.Platform | undefined,
  transition: FiscalPeriodTransition
) {
  const ctx = await requireManageContext(locals, cookies, platform);
  if (!ctx || !locals.user) return fail(403, { error: "Not signed in to a company." });

  const form = await request.formData();
  const values = { periodId: text(form.get("periodId")) };
  if (!values.periodId) return fail(400, { error: "Choose a fiscal period.", values });

  const result = await transition(
    {
      tenantId: ctx.org.id,
      periodId: values.periodId,
      actorId: locals.user.id
    },
    { accountingCoreStore: locals.accountingCoreStore, actor: ctx.actor }
  );
  if (!result.ok) return fail(result.status, { error: result.error.message, values });

  await recordEvent(
    {
      eventName: "accounting-core.fiscal_period_status_changed",
      actorId: locals.user.id,
      entityType: "fiscal_period",
      entityId: result.data.period.id,
      source: "app/ledger",
      payload: { status: result.data.period.status }
    },
    { auditStore: locals.auditStore }
  );

  return { fiscalPeriodStatusUpdated: true, fiscalPeriodStatus: result.data.period.status };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const deps = { accountingCoreStore: locals.accountingCoreStore };
  const [accountsResult, fiscalPeriodsResult] = await Promise.all([
    listAccounts({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, deps),
    listFiscalPeriods({ tenantId: activeOrgId, limit: 100 }, deps)
  ]);
  const fiscalPeriods = fiscalPeriodsResult.ok ? fiscalPeriodsResult.data.periods : [];
  const activePeriod = activePeriodFor(fiscalPeriods);
  const trialBalanceResult = await getTrialBalance(
    {
      tenantId: activeOrgId,
      includeZero: false,
      ...(activePeriod ? { periodId: activePeriod.id } : {})
    },
    deps
  );

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    accounts: accountsResult.ok ? accountsResult.data.accounts : [],
    fiscalPeriods,
    activePeriodId: activePeriod?.id ?? null,
    trialBalance: trialBalanceResult.ok ? trialBalanceResult.data.trialBalance : null,
    today: today()
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, platform }) => {
    const ctx = await requireManageContext(locals, cookies, platform);
    if (!ctx || !locals.user) return fail(403, { error: "Not signed in to a company." });

    const form = await request.formData();
    const values = {
      code: text(form.get("code")),
      name: text(form.get("name")),
      type: text(form.get("type")),
      description: text(form.get("description"))
    };
    const type = accountType(values.type);
    if (!values.code || !values.name || !type) return fail(400, { error: "Enter account code, name, and type.", values });

    const result = await createAccount(
      {
        tenantId: ctx.org.id,
        code: values.code,
        name: values.name,
        type,
        description: values.description || null,
        active: true
      },
      {
        accountingCoreStore: locals.accountingCoreStore,
        actor: ctx.actor
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.account_created",
        actorId: locals.user.id,
        entityType: "account",
        entityId: result.data.account.id,
        source: "app/ledger",
        payload: { code: result.data.account.code, type: result.data.account.type }
      },
      { auditStore: locals.auditStore }
    );

    return { created: true };
  },

  createFiscalPeriod: async ({ request, locals, cookies, platform }) => {
    const ctx = await requireManageContext(locals, cookies, platform);
    if (!ctx || !locals.user) return fail(403, { error: "Not signed in to a company." });

    const form = await request.formData();
    const values = {
      name: text(form.get("name")),
      periodType: text(form.get("periodType")) || "month",
      startsOn: text(form.get("startsOn")),
      endsOn: text(form.get("endsOn"))
    };
    const periodType = fiscalPeriodType(values.periodType);
    const startsOn = dateOnly(values.startsOn);
    const endsOn = dateOnly(values.endsOn);
    if (!values.name || !periodType || !startsOn || !endsOn) return fail(400, { error: "Enter period name, type, and dates.", values });

    const result = await createFiscalPeriod(
      {
        tenantId: ctx.org.id,
        name: values.name,
        periodType,
        startsOn,
        endsOn,
        status: "open"
      },
      { accountingCoreStore: locals.accountingCoreStore }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.fiscal_period_created",
        actorId: locals.user.id,
        entityType: "fiscal_period",
        entityId: result.data.period.id,
        source: "app/ledger",
        payload: { name: result.data.period.name, status: result.data.period.status }
      },
      { auditStore: locals.auditStore }
    );

    return { fiscalPeriodCreated: true };
  },

  closeFiscalPeriod: async ({ request, locals, cookies, platform }) =>
    changeFiscalPeriodStatus(request, locals, cookies, platform, closeAccountingFiscalPeriod),

  reopenFiscalPeriod: async ({ request, locals, cookies, platform }) =>
    changeFiscalPeriodStatus(request, locals, cookies, platform, reopenAccountingFiscalPeriod),

  lockFiscalPeriod: async ({ request, locals, cookies, platform }) =>
    changeFiscalPeriodStatus(request, locals, cookies, platform, lockAccountingFiscalPeriod),

  createJournalEntry: async ({ request, locals, cookies, platform }) => {
    const ctx = await requireManageContext(locals, cookies, platform);
    if (!ctx || !locals.user) return fail(403, { error: "Not signed in to a company." });

    const form = await request.formData();
    const values = {
      periodId: text(form.get("periodId")),
      entryDate: text(form.get("entryDate")),
      description: text(form.get("description")),
      debitAccountId: text(form.get("debitAccountId")),
      creditAccountId: text(form.get("creditAccountId")),
      amount: text(form.get("amount")),
      sourceRef: text(form.get("sourceRef"))
    };
    const entryDate = dateOnly(values.entryDate);
    const amountCents = cents(values.amount);
    if (!values.periodId || !entryDate || !values.debitAccountId || !values.creditAccountId || !amountCents) {
      return fail(400, { error: "Choose a period, date, debit account, credit account, and amount.", values });
    }
    if (values.debitAccountId === values.creditAccountId) return fail(400, { error: "Debit and credit accounts must differ.", values });

    const result = await createJournalEntry(
      {
        tenantId: ctx.org.id,
        periodId: values.periodId,
        entryDate,
        description: values.description || null,
        sourceRef: values.sourceRef || null,
        sourceType: values.sourceRef ? "app/ledger" : null,
        lines: [
          { accountId: values.debitAccountId, debitCents: amountCents, creditCents: 0, description: values.description || null },
          { accountId: values.creditAccountId, debitCents: 0, creditCents: amountCents, description: values.description || null }
        ]
      },
      { accountingCoreStore: locals.accountingCoreStore, actor: ctx.actor }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.journal_entry_created",
        actorId: locals.user.id,
        entityType: "journal_entry",
        entityId: result.data.entry.id,
        source: "app/ledger",
        payload: { periodId: values.periodId, amountCents, sourceRef: result.data.entry.sourceRef }
      },
      { auditStore: locals.auditStore }
    );

    return { journalCreated: true, journalEntryId: result.data.entry.id };
  },

  postJournalEntry: async ({ request, locals, cookies, platform }) => {
    const ctx = await requireManageContext(locals, cookies, platform);
    if (!ctx || !locals.user) return fail(403, { error: "Not signed in to a company." });

    const form = await request.formData();
    const values = { entryId: text(form.get("entryId")) };
    if (!values.entryId) return fail(400, { error: "Enter a draft journal entry ID.", values });

    const result = await postJournalEntry(
      { tenantId: ctx.org.id, entryId: values.entryId, postedById: locals.user.id },
      { accountingCoreStore: locals.accountingCoreStore, actor: ctx.actor }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.journal_entry_posted",
        actorId: locals.user.id,
        entityType: "journal_entry",
        entityId: result.data.entry.id,
        source: "app/ledger",
        payload: { sourceRef: result.data.entry.sourceRef }
      },
      { auditStore: locals.auditStore }
    );

    return { journalPosted: true };
  },

  voidJournalEntry: async ({ request, locals, cookies, platform }) => {
    const ctx = await requireManageContext(locals, cookies, platform);
    if (!ctx || !locals.user) return fail(403, { error: "Not signed in to a company." });

    const form = await request.formData();
    const values = {
      entryId: text(form.get("entryId")),
      reason: text(form.get("reason")),
      reversalDate: text(form.get("reversalDate")),
      reversalPeriodId: text(form.get("reversalPeriodId"))
    };
    const reversalDate = values.reversalDate ? dateOnly(values.reversalDate) : null;
    if (!values.entryId || (values.reversalDate && !reversalDate)) return fail(400, { error: "Enter a posted journal entry ID and valid reversal date.", values });

    const result = await voidJournalEntry(
      {
        tenantId: ctx.org.id,
        entryId: values.entryId,
        reason: values.reason || null,
        voidedById: locals.user.id,
        ...(values.reversalPeriodId ? { reversalPeriodId: values.reversalPeriodId } : {}),
        ...(reversalDate ? { reversalDate } : {})
      },
      { accountingCoreStore: locals.accountingCoreStore, actor: ctx.actor }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.journal_entry_voided",
        actorId: locals.user.id,
        entityType: "journal_entry",
        entityId: result.data.entry.id,
        source: "app/ledger",
        payload: { reversalEntryId: result.data.reversalEntry.id, reason: result.data.entry.voidReason }
      },
      { auditStore: locals.auditStore }
    );

    return { journalVoided: true, reversalEntryId: result.data.reversalEntry.id };
  }
};
