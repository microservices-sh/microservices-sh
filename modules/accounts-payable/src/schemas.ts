import { z } from "zod";

export const currencySchema = z.string().min(3).max(3).transform((value) => value.trim().toUpperCase());

export const createVendorInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(300),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  is1099Vendor: z.boolean().default(false),
  defaultExpenseAccountId: z.string().nullable().optional(),
  defaultPaymentTermsDays: z.number().int().min(0).max(365).default(30),
  currency: currencySchema.default("USD"),
  externalId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const updateVendorInputSchema = createVendorInputSchema
  .omit({ tenantId: true })
  .partial()
  .extend({
    tenantId: z.string().min(1),
    vendorId: z.string().min(1)
  });

export const updateVendorStatusInputSchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().min(1),
  active: z.boolean()
});

export const listVendorsInputSchema = z.object({
  tenantId: z.string().min(1),
  search: z.string().min(1).optional(),
  active: z.boolean().optional(),
  includeInactive: z.boolean().default(false),
  externalSource: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100)
});

export const vendorIdentitySchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().min(1)
});

export const billStatusSchema = z.enum(["draft", "pending_approval", "payable", "partial", "paid", "void"]);

export const billLineItemInputSchema = z.object({
  expenseAccountId: z.string().nullable().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  unitAmountCents: z.number().int().min(0),
  taxCents: z.number().int().min(0).default(0)
});

export const createBillInputSchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().min(1),
  billNumber: z.string().min(1).max(80).optional(),
  vendorBillNumber: z.string().max(120).nullable().optional(),
  billDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  currency: currencySchema.default("USD"),
  memo: z.string().max(2000).nullable().optional(),
  apAccountId: z.string().nullable().optional(),
  requiresApproval: z.boolean().default(false),
  recurringTemplateId: z.string().nullable().optional(),
  lineItems: z.array(billLineItemInputSchema).min(1),
  subtotalCents: z.number().int().min(0).optional(),
  taxCents: z.number().int().min(0).optional(),
  totalCents: z.number().int().min(0).optional()
});

export const billIdentitySchema = z.object({
  tenantId: z.string().min(1),
  billId: z.string().min(1)
});

export const markBillPayableInputSchema = billIdentitySchema.extend({
  approvedById: z.string().nullable().optional(),
  apAccountId: z.string().nullable().optional(),
  postToAccounting: z.boolean().default(true)
});

export const listBillsInputSchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().optional(),
  status: billStatusSchema.optional(),
  statuses: z.array(billStatusSchema).optional(),
  limit: z.number().int().min(1).max(500).default(100)
});

export const billPaymentMethodSchema = z.enum(["check", "ach", "wire", "card", "cash", "other"]);

export const billPaymentApplicationInputSchema = z.object({
  billId: z.string().min(1),
  amountCents: z.number().int().positive()
});

export const recordBillPaymentInputSchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().min(1),
  paymentDate: z.string().datetime(),
  amountCents: z.number().int().positive(),
  currency: currencySchema.default("USD"),
  paymentAccountId: z.string().nullable().optional(),
  paymentMethod: billPaymentMethodSchema.nullable().optional(),
  referenceNumber: z.string().max(120).nullable().optional(),
  memo: z.string().max(2000).nullable().optional(),
  idempotencyKey: z.string().min(1).max(200).nullable().optional(),
  applications: z.array(billPaymentApplicationInputSchema).min(1)
});

export const billPaymentIdentitySchema = z.object({
  tenantId: z.string().min(1),
  paymentId: z.string().min(1)
});

export const listBillPaymentsInputSchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().optional(),
  billId: z.string().optional(),
  status: z.enum(["posted", "void"]).optional(),
  paymentDateFrom: z.string().datetime().optional(),
  paymentDateBefore: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100)
});

export const vendor1099ReportInputSchema = z.object({
  tenantId: z.string().min(1),
  year: z.number().int().min(1970).max(9999)
});

export const agingReportInputSchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().optional(),
  asOfDate: z.string().datetime().optional()
});

export const recurringBillFrequencySchema = z.enum(["weekly", "monthly", "quarterly", "yearly", "custom"]);
export const recurringBillStatusSchema = z.enum(["active", "paused", "cancelled", "completed"]);

export const createRecurringBillTemplateInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(300),
  vendorId: z.string().min(1),
  frequency: recurringBillFrequencySchema.default("monthly"),
  customDays: z.number().int().positive().nullable().optional(),
  startDate: z.string().datetime(),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  maxOccurrences: z.number().int().positive().nullable().optional(),
  currency: currencySchema.default("USD"),
  memo: z.string().max(2000).nullable().optional(),
  autoMarkPayable: z.boolean().default(false),
  lineItems: z.array(billLineItemInputSchema).min(1),
  subtotalCents: z.number().int().min(0).optional(),
  taxCents: z.number().int().min(0).optional(),
  totalCents: z.number().int().min(0).optional()
});

export const listRecurringBillTemplatesInputSchema = z.object({
  tenantId: z.string().min(1),
  vendorId: z.string().optional(),
  status: recurringBillStatusSchema.optional(),
  statuses: z.array(recurringBillStatusSchema).optional(),
  dueOnOrBefore: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100)
});

export const recurringBillTemplateIdentitySchema = z.object({
  tenantId: z.string().min(1),
  templateId: z.string().min(1)
});

export const updateRecurringBillTemplateStatusInputSchema = z.object({
  tenantId: z.string().min(1),
  templateId: z.string().min(1),
  status: recurringBillStatusSchema
});

export const generateDueRecurringBillsInputSchema = z.object({
  tenantId: z.string().min(1),
  asOfDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  postToAccounting: z.boolean().default(true)
});

export type CreateVendorInput = z.infer<typeof createVendorInputSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorInputSchema>;
export type UpdateVendorStatusInput = z.infer<typeof updateVendorStatusInputSchema>;
export type ListVendorsInput = z.infer<typeof listVendorsInputSchema>;
export type VendorIdentityInput = z.infer<typeof vendorIdentitySchema>;
export type BillLineItemInput = z.infer<typeof billLineItemInputSchema>;
export type CreateBillInput = z.infer<typeof createBillInputSchema>;
export type MarkBillPayableInput = z.infer<typeof markBillPayableInputSchema>;
export type ListBillsInput = z.infer<typeof listBillsInputSchema>;
export type RecordBillPaymentInput = z.infer<typeof recordBillPaymentInputSchema>;
export type BillPaymentIdentityInput = z.infer<typeof billPaymentIdentitySchema>;
export type ListBillPaymentsInput = z.infer<typeof listBillPaymentsInputSchema>;
export type Vendor1099ReportInput = z.infer<typeof vendor1099ReportInputSchema>;
export type AgingReportInput = z.infer<typeof agingReportInputSchema>;
export type CreateRecurringBillTemplateInput = z.infer<typeof createRecurringBillTemplateInputSchema>;
export type ListRecurringBillTemplatesInput = z.infer<typeof listRecurringBillTemplatesInputSchema>;
export type RecurringBillTemplateIdentityInput = z.infer<typeof recurringBillTemplateIdentitySchema>;
export type UpdateRecurringBillTemplateStatusInput = z.infer<typeof updateRecurringBillTemplateStatusInputSchema>;
export type GenerateDueRecurringBillsInput = z.infer<typeof generateDueRecurringBillsInputSchema>;
