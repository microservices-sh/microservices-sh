import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import {
  getAccountingSetupStatus,
  seedChartOfAccounts,
  seedMonthlyFiscalPeriods,
  type ChartOfAccountsStandard
} from "@microservices-sh/accounting-core";
import { recordEvent } from "@microservices-sh/audit-log";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const CHART_STANDARDS = new Set<ChartOfAccountsStandard>(["gaap", "ifrs"]);
const CHART_STANDARD_OPTIONS = [
  { value: "gaap", label: "GAAP" },
  { value: "ifrs", label: "IFRS" }
];
const BASE_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "HKD", "SGD"];

function intValue(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function chartStandard(value: FormDataEntryValue | null): ChartOfAccountsStandard | null {
  const standard = String(value ?? "gaap").trim().toLowerCase();
  return CHART_STANDARDS.has(standard as ChartOfAccountsStandard) ? (standard as ChartOfAccountsStandard) : null;
}

function currencyCode(value: FormDataEntryValue | null): string | null {
  const currency = String(value ?? "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const status = await getAccountingSetupStatus(
    { tenantId: activeOrgId },
    { accountingCoreStore: locals.accountingCoreStore }
  );

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    currentYear: new Date().getUTCFullYear(),
    setup: status.ok
      ? status.data.status
      : {
          tenantId: activeOrgId,
          accountsConfigured: false,
          accountCount: 0,
          baseCurrency: null,
          fiscalPeriodsConfigured: false,
          fiscalPeriodCount: 0
        },
    chartStandards: CHART_STANDARD_OPTIONS,
    baseCurrencies: BASE_CURRENCIES
  };
};

export const actions: Actions = {
  seedAccounts: async ({ request, locals, cookies, platform }) => {
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const standard = chartStandard(form.get("standard"));
    const currency = currencyCode(form.get("baseCurrency"));
    const values = {
      standard: standard ?? String(form.get("standard") ?? "gaap"),
      baseCurrency: currency ?? String(form.get("baseCurrency") ?? "USD")
    };
    if (!standard) return fail(400, { error: "Choose a supported chart standard.", values });
    if (!currency) return fail(400, { error: "Enter a three-letter base currency code.", values });

    const result = await seedChartOfAccounts(
      { tenantId: org.id, standard, currency },
      { accountingCoreStore: locals.accountingCoreStore, now: () => Date.now() }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.account_created",
        actorId: locals.user.id,
        entityType: "organization",
        entityId: org.id,
        source: "app/settings/accounting",
        payload: { setupAction: "seedChartOfAccounts", count: result.data.count, standard: result.data.standard, currency }
      },
      { auditStore: locals.auditStore }
    );

    return { seededAccounts: true, accountCount: result.data.count, standard: result.data.standard, baseCurrency: currency };
  },

  seedPeriods: async ({ request, locals, cookies, platform }) => {
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const currentYear = new Date().getUTCFullYear();
    const year = intValue(form.get("year"), currentYear);
    const fiscalYearStartMonth = intValue(form.get("fiscalYearStartMonth"), 1);
    const values = { year, fiscalYearStartMonth };

    const result = await seedMonthlyFiscalPeriods(
      { tenantId: org.id, year, fiscalYearStartMonth },
      { accountingCoreStore: locals.accountingCoreStore, now: () => Date.now() }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.fiscal_period_created",
        actorId: locals.user.id,
        entityType: "organization",
        entityId: org.id,
        source: "app/settings/accounting",
        payload: { setupAction: "seedMonthlyFiscalPeriods", count: result.data.count, year }
      },
      { auditStore: locals.auditStore }
    );

    return { seededPeriods: true, periodCount: result.data.count };
  }
};
