import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getFiscalPeriod, getTrialBalance, listFiscalPeriods, type FiscalPeriodStatus } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const DAY_MS = 86_400_000;

const statusTone = (status: FiscalPeriodStatus): Tone => {
  if (status === "open") return "good";
  if (status === "closed") return "warn";
  if (status === "locked") return "bad";
  return "neutral";
};

function dateValue(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(dateValue(value))
  );
}

function daysInclusive(startsOn: string, endsOn: string): number {
  return Math.max(1, Math.round((dateValue(endsOn) - dateValue(startsOn)) / DAY_MS) + 1);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const deps = { accountingCoreStore: locals.accountingCoreStore };
  const [periodResult, periodsResult, trialBalanceResult] = await Promise.all([
    getFiscalPeriod({ tenantId: activeOrgId, periodId: params.id }, deps),
    listFiscalPeriods({ tenantId: activeOrgId, limit: 500 }, deps),
    getTrialBalance({ tenantId: activeOrgId, periodId: params.id, includeZero: true }, deps)
  ]);

  if (!periodResult.ok) throw error(periodResult.status, periodResult.error.message);

  const period = periodResult.data.period;
  const currentDay = today();
  const periods = periodsResult.ok ? periodsResult.data.periods : [];
  const sortedPeriods = [...periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const periodIndex = sortedPeriods.findIndex((candidate) => candidate.id === period.id);
  const fiscalYear = period.startsOn.slice(0, 4);
  const fiscalYearPeriods = sortedPeriods.filter((candidate) => candidate.startsOn.slice(0, 4) === fiscalYear);
  const trialBalance = trialBalanceResult.ok ? trialBalanceResult.data.trialBalance : null;
  const activityLines = trialBalance
    ? trialBalance.lines.filter((line) => line.debitCents !== 0 || line.creditCents !== 0 || line.balanceCents !== 0)
    : [];

  return {
    period: {
      ...period,
      statusTone: statusTone(period.status),
      startsOnShort: shortDate(period.startsOn),
      endsOnShort: shortDate(period.endsOn),
      dayCount: daysInclusive(period.startsOn, period.endsOn),
      isCurrent: period.startsOn <= currentDay && period.endsOn >= currentDay,
      postingAllowed: period.status === "open",
      closed: relativeTime(period.closedAt),
      locked: relativeTime(period.lockedAt),
      created: relativeTime(period.createdAt),
      updated: relativeTime(period.updatedAt)
    },
    adjacentPeriods: [
      { label: "Previous", period: periodIndex > 0 ? sortedPeriods[periodIndex - 1] : null },
      { label: "Next", period: periodIndex >= 0 && periodIndex < sortedPeriods.length - 1 ? sortedPeriods[periodIndex + 1] : null }
    ].map((item) => ({
      label: item.label,
      period: item.period
        ? {
            id: item.period.id,
            name: item.period.name,
            startsOn: shortDate(item.period.startsOn),
            endsOn: shortDate(item.period.endsOn),
            status: item.period.status,
            statusTone: statusTone(item.period.status)
          }
        : null
    })),
    fiscalYear: {
      year: fiscalYear,
      total: fiscalYearPeriods.length,
      open: fiscalYearPeriods.filter((candidate) => candidate.status === "open").length,
      closed: fiscalYearPeriods.filter((candidate) => candidate.status === "closed").length,
      locked: fiscalYearPeriods.filter((candidate) => candidate.status === "locked").length
    },
    trialBalance: trialBalance
      ? {
          balanced: trialBalance.balanced,
          totalDebit: money(trialBalance.totalDebitCents),
          totalCredit: money(trialBalance.totalCreditCents),
          activityCount: activityLines.length,
          lines: activityLines.map((line) => ({
            ...line,
            debit: money(line.debitCents),
            credit: money(line.creditCents),
            balance: money(line.balanceCents)
          }))
        }
      : null
  };
};
