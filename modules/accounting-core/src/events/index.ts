export const accountingCoreEvents = {
  emitted: [
    "accounting-core.account_created",
    "accounting-core.fiscal_period_created",
    "accounting-core.fiscal_period_status_changed",
    "accounting-core.settings_updated",
    "accounting-core.journal_entry_created",
    "accounting-core.journal_entry_updated",
    "accounting-core.journal_entry_posted",
    "accounting-core.journal_entry_voided"
  ],
  consumed: []
} as const;
