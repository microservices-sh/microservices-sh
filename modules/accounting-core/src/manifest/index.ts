export const manifest = {
  schemaVersion: "2026-06-13",
  id: "accounting-core",
  name: "Accounting Core",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped double-entry accounting foundation with setup settings, chart of accounts, fiscal periods, balanced posting, voiding, trial balance, general ledger, and financial statements.",
  entrypoint: "src/index.ts",
  permissions: [
    "accounting-core.read",
    "accounting-core.write",
    "accounting-core.admin",
    "accounting-core.extend",
    "accounting-core.observe"
  ],
  resources: [
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
  ],
  connections: {
    requires: [],
    optional: ["auth", "audit-log"],
    rpc: {
      exposes: [
        {
          method: "listAccounts",
          scope: "accounting-core.read",
          public: false
        },
        {
          method: "getAccount",
          scope: "accounting-core.read",
          public: false
        },
        {
          method: "createAccount",
          scope: "accounting-core.write",
          public: false
        },
        {
          method: "createFiscalPeriod",
          scope: "accounting-core.write",
          public: false
        },
        {
          method: "createJournalEntry",
          scope: "accounting-core.write",
          public: false
        },
        {
          method: "postJournalEntry",
          scope: "accounting-core.write",
          public: false
        },
        {
          method: "voidJournalEntry",
          scope: "accounting-core.write",
          public: false
        },
        {
          method: "getTrialBalance",
          scope: "accounting-core.read",
          public: false
        },
        {
          method: "getGeneralLedger",
          scope: "accounting-core.read",
          public: false
        },
        {
          method: "getIncomeStatement",
          scope: "accounting-core.read",
          public: false
        },
        {
          method: "getBalanceSheet",
          scope: "accounting-core.read",
          public: false
        },
        {
          method: "getCashFlowStatement",
          scope: "accounting-core.read",
          public: false
        }
      ],
      calls: []
    },
    events: {
      emits: [
        "accounting-core.account_created",
        "accounting-core.fiscal_period_created",
        "accounting-core.fiscal_period_status_changed",
        "accounting-core.settings_updated",
        "accounting-core.journal_entry_created",
        "accounting-core.journal_entry_updated",
        "accounting-core.journal_entry_posted",
        "accounting-core.journal_entry_voided"
      ],
      consumes: []
    },
    hookPoints: {
      beforeAccountCreate: {
        kind: "filter",
        scope: "accounting-core.extend"
      },
      beforeFiscalPeriodCreate: {
        kind: "filter",
        scope: "accounting-core.extend"
      },
      beforeJournalEntryCreate: {
        kind: "filter",
        scope: "accounting-core.extend"
      },
      beforeJournalEntryPost: {
        kind: "filter",
        scope: "accounting-core.extend"
      },
      beforeJournalEntryVoid: {
        kind: "filter",
        scope: "accounting-core.extend"
      },
      afterJournalEntryChanged: {
        kind: "observer",
        scope: "accounting-core.observe"
      }
    },
    provides: {
      hooks: []
    }
  },
  events: [
    "accounting-core.account_created",
    "accounting-core.fiscal_period_created",
    "accounting-core.fiscal_period_status_changed",
    "accounting-core.journal_entry_created",
    "accounting-core.journal_entry_updated",
    "accounting-core.journal_entry_posted",
    "accounting-core.journal_entry_voided"
  ],
  surfaces: {
    agentic: {
      applicable: true,
      tools: [
        "accounting-core.listAccounts",
        "accounting-core.getAccount",
        "accounting-core.createAccount",
        "accounting-core.updateAccountingSettings",
        "accounting-core.createFiscalPeriod",
        "accounting-core.closeFiscalPeriod",
        "accounting-core.getFiscalPeriod",
        "accounting-core.listFiscalPeriods",
        "accounting-core.lockFiscalPeriod",
        "accounting-core.reopenFiscalPeriod",
        "accounting-core.createJournalEntry",
        "accounting-core.postJournalEntry",
        "accounting-core.voidJournalEntry",
        "accounting-core.getTrialBalance",
        "accounting-core.getGeneralLedger",
        "accounting-core.getIncomeStatement",
        "accounting-core.getBalanceSheet",
        "accounting-core.getCashFlowStatement"
      ],
      approvalRequiredFor: [
        "accounting-core.createAccount",
        "accounting-core.updateAccountingSettings",
        "accounting-core.createFiscalPeriod",
        "accounting-core.closeFiscalPeriod",
        "accounting-core.lockFiscalPeriod",
        "accounting-core.reopenFiscalPeriod",
        "accounting-core.postJournalEntry",
        "accounting-core.voidJournalEntry"
      ]
    }
  }
} as const;

export const moduleDefinition = manifest;
