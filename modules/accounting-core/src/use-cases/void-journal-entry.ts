import { voidJournalEntrySchema } from "../schemas";
import { accountingId, dateNow, isoNow, normalizeOptional } from "../service";
import type { Actor, JournalEntry, JournalLine } from "../types";
import {
  err,
  getEntryWithLines,
  hooks,
  ok,
  validateEntryPeriod,
  type AccountingDeps
} from "./shared";

export async function voidJournalEntry(input: unknown, deps: AccountingDeps & { actor?: Actor | null }) {
  const filtered = await hooks(deps).beforeJournalEntryVoid(input);
  const parsed = voidJournalEntrySchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_VOID_INPUT", "Journal entry void input is invalid.", parsed.error.issues);
  }

  const existing = await getEntryWithLines(deps.accountingCoreStore, parsed.data.tenantId, parsed.data.entryId);
  if (!existing) return err(404, "accounting-core.JOURNAL_ENTRY_NOT_FOUND", "Journal entry not found.");
  if (existing.status !== "posted") {
    return err(409, "accounting-core.JOURNAL_ENTRY_NOT_VOIDABLE", "Only posted journal entries can be voided.");
  }

  const now = isoNow(deps.now);
  const reversalDate = parsed.data.reversalDate ?? dateNow(deps.now);
  const reversalPeriodId = parsed.data.reversalPeriodId ?? existing.periodId;
  const periodValidation = await validateEntryPeriod(
    deps.accountingCoreStore,
    existing.tenantId,
    reversalPeriodId,
    reversalDate,
    true
  );
  if (!periodValidation.ok) return periodValidation;

  const reversalSourceRef = `void:${existing.id}`;
  const duplicateReversal = await deps.accountingCoreStore.findPostedEntryBySourceRef(existing.tenantId, reversalSourceRef);
  if (duplicateReversal) {
    return err(409, "accounting-core.JOURNAL_ENTRY_ALREADY_VOIDED", "This journal entry already has a reversal entry.");
  }

  const reversalId = accountingId("je");
  const reversal: JournalEntry = {
    id: reversalId,
    tenantId: existing.tenantId,
    periodId: reversalPeriodId,
    entryDate: reversalDate,
    description: normalizeOptional(`Void ${existing.id}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`),
    status: "posted",
    sourceRef: reversalSourceRef,
    sourceType: "accounting-core.void",
    postedAt: now,
    postedById: normalizeOptional(parsed.data.voidedById) ?? deps.actor?.id ?? null,
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    reversalEntryId: null,
    reversesEntryId: existing.id,
    createdById: deps.actor?.id ?? null,
    createdAt: now,
    updatedAt: now
  };
  const reversalLines: JournalLine[] = existing.lines.map((line) => ({
    id: accountingId("jel"),
    tenantId: line.tenantId,
    entryId: reversalId,
    accountId: line.accountId,
    description: normalizeOptional(`Reversal of ${line.id}`),
    debitCents: line.creditCents,
    creditCents: line.debitCents,
    createdAt: now
  }));
  const { lines: _existingLines, ...existingEntry } = existing;
  const voided = {
    ...existingEntry,
    status: "void" as const,
    voidedAt: now,
    voidedById: normalizeOptional(parsed.data.voidedById) ?? deps.actor?.id ?? null,
    voidReason: normalizeOptional(parsed.data.reason),
    reversalEntryId: reversal.id,
    updatedAt: now
  };

  await deps.accountingCoreStore.voidJournalEntry(voided, reversal, reversalLines);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.journal_entry_voided",
    entityType: "journal_entry",
    entityId: voided.id,
    tenantId: voided.tenantId,
    payload: {
      actorId: deps.actor?.id ?? null,
      reversalEntryId: reversal.id,
      reason: voided.voidReason
    }
  });

  const [voidedEntry, reversalEntry] = await Promise.all([
    getEntryWithLines(deps.accountingCoreStore, voided.tenantId, voided.id),
    getEntryWithLines(deps.accountingCoreStore, reversal.tenantId, reversal.id)
  ]);
  if (!voidedEntry || !reversalEntry) {
    return err(500, "accounting-core.JOURNAL_ENTRY_WRITE_FAILED", "Journal entry void was not persisted.");
  }
  await hooks(deps).afterJournalEntryChanged(voidedEntry);
  await hooks(deps).afterJournalEntryChanged(reversalEntry);

  return ok(200, { entry: voidedEntry, reversalEntry });
}
