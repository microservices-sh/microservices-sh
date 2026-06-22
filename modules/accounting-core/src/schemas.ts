import { z } from "zod";

export const accountingCoreConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().min(3).max(3).default("USD")
});

export const accountTypeSchema = z.enum(["asset", "liability", "equity", "revenue", "expense"]);
export const accountSubtypeSchema = z.enum([
  "current_asset",
  "fixed_asset",
  "other_asset",
  "current_liability",
  "long_term_liability",
  "owner_equity",
  "retained_earnings",
  "operating_revenue",
  "other_revenue",
  "operating_expense",
  "cogs",
  "other_expense"
]);
export const normalBalanceSchema = z.enum(["debit", "credit"]);
export const fiscalPeriodTypeSchema = z.enum(["month", "quarter", "year", "custom"]);
export const fiscalPeriodStatusSchema = z.enum(["open", "closed", "locked"]);
export const journalEntryStatusSchema = z.enum(["draft", "posted", "void"]);
export const chartOfAccountsStandardSchema = z.enum(["gaap", "ifrs"]);

export const accountInputSchema = z.object({
  tenantId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeSchema,
  subtype: accountSubtypeSchema.nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  currency: z.string().min(3).max(3).default("USD"),
  normalBalance: normalBalanceSchema.optional(),
  description: z.string().nullable().optional(),
  isSystem: z.boolean().default(false),
  isReconcilable: z.boolean().default(false),
  isHeader: z.boolean().default(false),
  active: z.boolean().default(true)
});

export const accountUpdateSchema = accountInputSchema.partial().extend({
  tenantId: z.string().min(1),
  accountId: z.string().min(1)
});

export const accountFilterSchema = z.object({
  tenantId: z.string().min(1),
  includeInactive: z.boolean().optional(),
  type: accountTypeSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional()
});

export const accountIdentitySchema = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1)
});

export const fiscalPeriodInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  periodType: fiscalPeriodTypeSchema.default("month"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: fiscalPeriodStatusSchema.default("open")
});

export const fiscalPeriodStatusUpdateSchema = z.object({
  tenantId: z.string().min(1),
  periodId: z.string().min(1),
  status: fiscalPeriodStatusSchema,
  actorId: z.string().min(1).nullable().optional()
});

export const fiscalPeriodIdentitySchema = z.object({
  tenantId: z.string().min(1),
  periodId: z.string().min(1)
});

export const fiscalPeriodTransitionSchema = fiscalPeriodIdentitySchema.extend({
  actorId: z.string().min(1).nullable().optional()
});

export const fiscalPeriodFilterSchema = z.object({
  tenantId: z.string().min(1),
  status: fiscalPeriodStatusSchema.optional(),
  periodType: fiscalPeriodTypeSchema.optional(),
  limit: z.number().int().min(1).max(500).optional()
});

export const journalLineInputSchema = z.object({
  accountId: z.string().min(1),
  description: z.string().nullable().optional(),
  debitCents: z.number().int().min(0).default(0),
  creditCents: z.number().int().min(0).default(0)
});

export const journalEntryInputSchema = z.object({
  tenantId: z.string().min(1),
  periodId: z.string().min(1),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  lines: z.array(journalLineInputSchema).min(2)
});

export const journalEntryUpdateSchema = journalEntryInputSchema
  .omit({ tenantId: true, lines: true })
  .partial()
  .extend({
    tenantId: z.string().min(1),
    entryId: z.string().min(1),
    lines: z.array(journalLineInputSchema).min(2).optional()
  });

export const postJournalEntrySchema = z.object({
  tenantId: z.string().min(1),
  entryId: z.string().min(1),
  postedById: z.string().nullable().optional()
});

export const voidJournalEntrySchema = z.object({
  tenantId: z.string().min(1),
  entryId: z.string().min(1),
  reason: z.string().nullable().optional(),
  voidedById: z.string().nullable().optional(),
  reversalPeriodId: z.string().min(1).optional(),
  reversalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const trialBalanceSchema = z.object({
  tenantId: z.string().min(1),
  periodId: z.string().min(1).optional(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeZero: z.boolean().optional()
});

export const generalLedgerSchema = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  periodId: z.string().min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeOpeningBalance: z.boolean().optional()
});

export const setupStatusInputSchema = z.object({
  tenantId: z.string().min(1)
});

export const accountingSettingsSchema = z.object({
  tenantId: z.string().min(1),
  accountingStandard: chartOfAccountsStandardSchema.optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  baseCurrency: z.string().min(3).max(3).optional(),
  defaultArAccountId: z.string().min(1).nullable().optional(),
  defaultApAccountId: z.string().min(1).nullable().optional(),
  defaultIncomeAccountId: z.string().min(1).nullable().optional(),
  defaultDepositAccountId: z.string().min(1).nullable().optional(),
  stripeDepositAccountId: z.string().min(1).nullable().optional()
});

export const seedChartOfAccountsSchema = z.object({
  tenantId: z.string().min(1),
  standard: chartOfAccountsStandardSchema.default("gaap"),
  currency: z.string().min(3).max(3).default("USD")
});

export const seedMonthlyFiscalPeriodsSchema = z.object({
  tenantId: z.string().min(1),
  year: z.number().int().min(1900).max(9999),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1)
});

export const accountRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeSchema,
  subtype: accountSubtypeSchema.nullable(),
  parentId: z.string().nullable(),
  currency: z.string().min(3).max(3),
  normalBalance: normalBalanceSchema,
  isSystem: z.boolean(),
  isReconcilable: z.boolean(),
  isHeader: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});
