import type { AccountType, FiscalPeriod, NormalBalance } from "../types";

export function accountingId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function isoNow(now?: () => number): string {
  return new Date(now ? now() : Date.now()).toISOString();
}

export function dateNow(now?: () => number): string {
  return isoNow(now).slice(0, 10);
}

export function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeAccountCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalBalanceForType(type: AccountType): NormalBalance {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

export function dateInPeriod(entryDate: string, period: FiscalPeriod): boolean {
  return entryDate >= period.startsOn && entryDate <= period.endsOn;
}
