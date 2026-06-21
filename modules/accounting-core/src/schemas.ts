import { z } from "zod";

export const accountingCoreConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().min(3).max(3).default("USD")
});

export const accountTypeSchema = z.enum(["asset", "liability", "equity", "revenue", "expense"]);
export const normalBalanceSchema = z.enum(["debit", "credit"]);
export const fiscalPeriodStatusSchema = z.enum(["open", "closed", "locked"]);
export const journalEntryStatusSchema = z.enum(["draft", "posted", "void"]);

export const accountInputSchema = z.object({
  tenantId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeSchema,
  description: z.string().nullable().optional(),
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

export const fiscalPeriodInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: fiscalPeriodStatusSchema.default("open")
});

export const fiscalPeriodStatusUpdateSchema = z.object({
  tenantId: z.string().min(1),
  periodId: z.string().min(1),
  status: fiscalPeriodStatusSchema
});

export const fiscalPeriodFilterSchema = z.object({
  tenantId: z.string().min(1),
  status: fiscalPeriodStatusSchema.optional(),
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

export const accountRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeSchema,
  normalBalance: normalBalanceSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});
