import { postJournalEntrySchema } from "../schemas";
import { isoNow, normalizeOptional } from "../service";
import type { Actor } from "../types";
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

export async function postJournalEntry(input: unknown, deps: AccountingDeps & { actor?: Actor | null }) {
  const filtered = await hooks(deps).beforeJournalEntryPost(input);
  const parsed = postJournalEntrySchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_POST_INPUT", "Journal entry post input is invalid.", parsed.error.issues);
  }

  const existing = await getEntryWithLines(deps.accountingCoreStore, parsed.data.tenantId, parsed.data.entryId);
  if (!existing) return err(404, "accounting-core.JOURNAL_ENTRY_NOT_FOUND", "Journal entry not found.");
  if (existing.status !== "draft") {
    return err(409, "accounting-core.JOURNAL_ENTRY_NOT_POSTABLE", "Only draft journal entries can be posted.");
  }

  const periodValidation = await validateEntryPeriod(
    deps.accountingCoreStore,
    existing.tenantId,
    existing.periodId,
    existing.entryDate,
    true
  );
  if (!periodValidation.ok) return periodValidation;

  const balanceError = validateBalancedLines(existing.lines);
  if (balanceError) return balanceError;
  const accountValidation = await resolveLineAccounts(deps.accountingCoreStore, existing.tenantId, existing.lines);
  if (accountValidation && !accountValidation.ok) return accountValidation;

  if (existing.sourceRef) {
    const duplicate = await deps.accountingCoreStore.findPostedEntryBySourceRef(
      existing.tenantId,
      existing.sourceRef,
      existing.id
    );
    if (duplicate) {
      return err(409, "accounting-core.SOURCE_REF_CONFLICT", "A posted journal entry already uses this source reference.");
    }
  }

  const now = isoNow(deps.now);
  const { lines, ...entryRecord } = existing;
  const posted = {
    ...entryRecord,
    status: "posted" as const,
    postedAt: now,
    postedById: normalizeOptional(parsed.data.postedById) ?? deps.actor?.id ?? null,
    updatedAt: now
  };

  await deps.accountingCoreStore.updateJournalEntry(posted, lines);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.journal_entry_posted",
    entityType: "journal_entry",
    entityId: posted.id,
    tenantId: posted.tenantId,
    payload: { actorId: deps.actor?.id ?? null, sourceRef: posted.sourceRef }
  });

  const enriched = await getEntryWithLines(deps.accountingCoreStore, posted.tenantId, posted.id);
  if (!enriched) return err(500, "accounting-core.JOURNAL_ENTRY_WRITE_FAILED", "Journal entry was not persisted.");
  await hooks(deps).afterJournalEntryChanged(enriched);

  return ok(200, { entry: enriched });
}
