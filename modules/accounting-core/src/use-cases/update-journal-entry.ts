import { journalEntryUpdateSchema } from "../schemas";
import { accountingId, isoNow, normalizeOptional } from "../service";
import type { Actor, JournalLine } from "../types";
import {
  err,
  getEntryWithLines,
  hooks,
  ok,
  resolveLineAccounts,
  validateBalancedLines,
  validateEntryPeriod,
  type AccountingDeps
} from "./shared";

export async function updateJournalEntry(input: unknown, deps: AccountingDeps & { actor?: Actor | null }) {
  const parsed = journalEntryUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_JOURNAL_ENTRY_UPDATE", "Journal entry update is invalid.", parsed.error.issues);
  }

  const existing = await getEntryWithLines(deps.accountingCoreStore, parsed.data.tenantId, parsed.data.entryId);
  if (!existing) return err(404, "accounting-core.JOURNAL_ENTRY_NOT_FOUND", "Journal entry not found.");
  if (existing.status !== "draft") {
    return err(409, "accounting-core.POSTED_ENTRY_IMMUTABLE", "Posted or voided journal entries cannot be edited.");
  }

  const entryDate = parsed.data.entryDate ?? existing.entryDate;
  const periodId = parsed.data.periodId ?? existing.periodId;
  const periodValidation = await validateEntryPeriod(
    deps.accountingCoreStore,
    existing.tenantId,
    periodId,
    entryDate,
    false
  );
  if (!periodValidation.ok) return periodValidation;

  const now = isoNow(deps.now);
  const lines: JournalLine[] =
    parsed.data.lines === undefined
      ? existing.lines
      : parsed.data.lines.map((line) => ({
          id: accountingId("jel"),
          tenantId: existing.tenantId,
          entryId: existing.id,
          accountId: line.accountId,
          description: normalizeOptional(line.description),
          debitCents: line.debitCents,
          creditCents: line.creditCents,
          createdAt: now
        }));

  const balanceError = validateBalancedLines(lines);
  if (balanceError) return balanceError;

  const accountValidation = await resolveLineAccounts(deps.accountingCoreStore, existing.tenantId, lines);
  if (accountValidation && !accountValidation.ok) return accountValidation;

  const { lines: _existingLines, ...existingEntry } = existing;
  const updated = {
    ...existingEntry,
    periodId,
    entryDate,
    description: parsed.data.description !== undefined ? normalizeOptional(parsed.data.description) : existing.description,
    sourceRef: parsed.data.sourceRef !== undefined ? normalizeOptional(parsed.data.sourceRef) : existing.sourceRef,
    sourceType: parsed.data.sourceType !== undefined ? normalizeOptional(parsed.data.sourceType) : existing.sourceType,
    updatedAt: now
  };

  await deps.accountingCoreStore.updateJournalEntry(updated, lines);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.journal_entry_updated",
    entityType: "journal_entry",
    entityId: updated.id,
    tenantId: updated.tenantId,
    payload: { actorId: deps.actor?.id ?? null, sourceRef: updated.sourceRef }
  });

  const enriched = await getEntryWithLines(deps.accountingCoreStore, updated.tenantId, updated.id);
  if (!enriched) return err(500, "accounting-core.JOURNAL_ENTRY_WRITE_FAILED", "Journal entry was not persisted.");
  await hooks(deps).afterJournalEntryChanged(enriched);

  return ok(200, { entry: enriched });
}
