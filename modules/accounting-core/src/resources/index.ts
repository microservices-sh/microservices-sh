export const accountingCoreResources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "accounting_accounts",
      "accounting_settings",
      "accounting_fiscal_periods",
      "accounting_journal_entries",
      "accounting_journal_lines",
      "domain_events"
    ]
  }
] as const;
