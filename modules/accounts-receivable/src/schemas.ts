import { z } from "zod";

export const accountsReceivableConfigSchema = z.object({
  enabled: z.boolean().default(true)
});

export const invoiceSnapshotSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  issuedAt: z.string().min(1),
  dueDate: z.string().min(1),
  totalCents: z.number().int(),
  amountPaidCents: z.number().int(),
  amountDueCents: z.number().int(),
  status: z.enum(["open", "paid", "void"])
});

export const customerPaymentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  amountCents: z.number().int(),
  unappliedCents: z.number().int(),
  paymentDate: z.string().min(1),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().min(1)
});

export const paymentApplicationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  paymentId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountCents: z.number().int(),
  appliedAt: z.string().min(1)
});

export const accountsReceivableRecordSchema = z.union([
  invoiceSnapshotSchema,
  customerPaymentSchema,
  paymentApplicationSchema
]);
