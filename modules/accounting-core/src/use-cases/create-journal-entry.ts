import { journalEntryInputSchema } from "../schemas";
import { accountingId, isoNow, normalizeOptional } from "../service";
import type { Actor, JournalEntry, JournalLine } from "../types";
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

export async function createJournalEntry(input: unknown, deps: AccountingDeps & { actor?: Actor | null }) {
  const filtered = await hooks(deps).beforeJournalEntryCreate(input);
  const parsed = journalEntryInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_JOURNAL_ENTRY_INPUT", "Journal entry input is invalid.", parsed.error.issues);
  }

  const periodValidation = await validateEntryPeriod(
    deps.accountingCoreStore,
    parsed.data.tenantId,
    parsed.data.periodId,
    parsed.data.entryDate,
    false
  );
  if (!periodValidation.ok) return periodValidation;

  const balanceError = validateBalancedLines(parsed.data.lines);
  if (balanceError) return balanceError;

  const accountValidation = await resolveLineAccounts(deps.accountingCoreStore, parsed.data.tenantId, parsed.data.lines);
  if (accountValidation && !accountValidation.ok) return accountValidation;

  const now = isoNow(deps.now);
  const entryId = accountingId("je");
  const entry: JournalEntry = {
    id: entryId,
    tenantId: parsed.data.tenantId,
    periodId: parsed.data.periodId,
    entryDate: parsed.data.entryDate,
    description: normalizeOptional(parsed.data.description),
    status: "draft",
    sourceRef: normalizeOptional(parsed.data.sourceRef),
    sourceType: normalizeOptional(parsed.data.sourceType),
    postedAt: null,
    postedById: null,
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    reversalEntryId: null,
    reversesEntryId: null,
    createdById: deps.actor?.id ?? null,
    createdAt: now,
    updatedAt: now
  };
  const lines: JournalLine[] = parsed.data.lines.map((line) => ({
    id: accountingId("jel"),
    tenantId: parsed.data.tenantId,
    entryId,
    accountId: line.accountId,
    description: normalizeOptional(line.description),
    debitCents: line.debitCents,
    creditCents: line.creditCents,
    createdAt: now
  }));

  await deps.accountingCoreStore.insertJournalEntry(entry, lines);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.journal_entry_created",
    entityType: "journal_entry",
    entityId: entry.id,
    tenantId: entry.tenantId,
    payload: { actorId: deps.actor?.id ?? null, sourceRef: entry.sourceRef }
  });

  const enriched = await getEntryWithLines(deps.accountingCoreStore, entry.tenantId, entry.id);
  if (!enriched) return err(500, "accounting-core.JOURNAL_ENTRY_WRITE_FAILED", "Journal entry was not persisted.");
  await hooks(deps).afterJournalEntryChanged(enriched);

  return ok(201, { entry: enriched });
}
