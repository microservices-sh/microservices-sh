import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableText = z.string().nullable().optional();

export const bankReconciliationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().min(3).max(3).default("USD"),
  defaultDateToleranceDays: z.number().int().min(0).max(30).default(3),
  defaultAmountToleranceCents: z.number().int().min(0).max(100_000).default(0)
});

export const bankAccountTypeSchema = z.enum(["checking", "savings", "credit_card", "money_market", "other"]);
export const statementImportSourceSchema = z.enum(["csv", "ofx", "qfx", "qif", "api"]);
export const statementImportStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export const statementImportFieldMappingPresetIdSchema = z.enum(["standard_amount", "details_debit_credit", "posted_amount"]);
export const statementTransactionTypeSchema = z.enum([
  "deposit",
  "withdrawal",
  "transfer",
  "check",
  "fee",
  "interest",
  "other"
]);
export const matchStatusSchema = z.enum(["unmatched", "auto_matched", "manual_matched", "excluded"]);
export const matchTypeSchema = z.enum(["auto", "manual", "rule"]);
export const matchTargetTypeSchema = z.enum(["ledger_entry", "ledger_line", "payment", "external_ref"]);
export const reconciliationStatusSchema = z.enum(["in_progress", "completed", "abandoned"]);

export const bankAccountInputSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  name: z.string().min(1),
  bankName: nullableText,
  accountMask: nullableText,
  routingNumber: nullableText,
  accountType: bankAccountTypeSchema.default("checking"),
  ledgerAccountId: nullableText,
  currency: z.string().min(3).max(3).default("USD"),
  openingBalanceCents: z.number().int().default(0),
  openingBalanceDate: isoDate.nullable().optional(),
  currentBalanceCents: z.number().int().optional(),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false)
});

export const bankAccountFilterSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  includeInactive: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional()
});

export const statementTransactionInputSchema = z.object({
  transactionDate: isoDate,
  postDate: isoDate.nullable().optional(),
  description: z.string().min(1),
  payee: nullableText,
  memo: nullableText,
  checkNumber: nullableText,
  referenceNumber: nullableText,
  amountCents: z.number().int().refine((value) => value !== 0, "amountCents must be non-zero"),
  transactionHash: z.string().min(1).optional(),
  transactionType: statementTransactionTypeSchema.optional()
});

export const statementImportFieldMappingSchema = z
  .object({
    presetId: statementImportFieldMappingPresetIdSchema.optional(),
    date: z.string().min(1),
    description: z.string().min(1),
    amount: z.string().min(1).optional(),
    debit: z.string().min(1).optional(),
    credit: z.string().min(1).optional()
  })
  .refine((mapping) => Boolean(mapping.amount || (mapping.debit && mapping.credit)), {
    message: "CSV mapping must include amount or both debit and credit fields."
  });

export const importStatementTransactionsSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  bankAccountId: z.string().min(1),
  source: statementImportSourceSchema.default("csv"),
  fileName: nullableText,
  fileKey: nullableText,
  fileSize: z.number().int().min(0).nullable().optional(),
  sourceId: nullableText,
  fieldMapping: z.record(z.string(), z.string()).nullable().optional(),
  importedById: nullableText,
  transactions: z.array(statementTransactionInputSchema).min(1)
});

export const importStatementCsvSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  bankAccountId: z.string().min(1),
  source: statementImportSourceSchema.default("csv"),
  fileName: nullableText,
  importedById: nullableText,
  fieldMapping: statementImportFieldMappingSchema.optional(),
  fieldMappingPresetId: statementImportFieldMappingPresetIdSchema.nullable().optional(),
  csvContent: z.string().min(1)
}).refine((input) => Boolean(input.fieldMapping || input.fieldMappingPresetId), {
  message: "CSV import requires a field mapping or mapping preset."
});

export const statementTransactionFilterSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  bankAccountId: z.string().min(1).optional(),
  statementImportId: z.string().min(1).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  matchStatus: matchStatusSchema.optional(),
  reconciled: z.boolean().optional(),
  includeExcluded: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).optional()
});

export const matchCandidateSchema = z.object({
  targetType: matchTargetTypeSchema,
  targetId: z.string().min(1),
  targetRef: nullableText,
  targetDate: isoDate.nullable().optional(),
  amountCents: z.number().int(),
  description: nullableText,
  source: nullableText,
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const suggestMatchesSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  transactionId: z.string().min(1),
  candidates: z.array(matchCandidateSchema).optional(),
  dateToleranceDays: z.number().int().min(0).max(30).default(3),
  amountToleranceCents: z.number().int().min(0).max(100_000).default(0),
  limit: z.number().int().min(1).max(100).default(10)
});

export const createMatchSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  transactionId: z.string().min(1),
  targetType: matchTargetTypeSchema,
  targetId: z.string().min(1),
  targetRef: nullableText,
  targetDate: isoDate.nullable().optional(),
  targetAmountCents: z.number().int(),
  description: nullableText,
  matchType: matchTypeSchema.default("manual"),
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  reconciliationId: z.string().min(1).nullable().optional()
});

export const unmatchTransactionSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  transactionId: z.string().min(1),
  matchId: z.string().min(1).nullable().optional()
});

export const excludeTransactionSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  transactionId: z.string().min(1),
  reason: nullableText
});

export const restoreExcludedTransactionSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  transactionId: z.string().min(1)
});

export const startReconciliationSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  bankAccountId: z.string().min(1),
  statementDate: isoDate,
  periodStart: isoDate,
  periodEnd: isoDate,
  openingBalanceCents: z.number().int().optional(),
  statementEndingBalanceCents: z.number().int(),
  createdById: nullableText
});

export const completeReconciliationSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  reconciliationId: z.string().min(1),
  completedById: nullableText,
  notes: nullableText
});

export const reconciliationFilterSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().nullable().optional(),
  bankAccountId: z.string().min(1).optional(),
  status: reconciliationStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional()
});

export const bankAccountRecordSchema = bankAccountInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});
