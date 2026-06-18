import { z } from "zod";

export const createUploadTicketInputSchema = z.object({
  tenantId: z.string().min(1),
  ownerId: z.string().min(1).nullable().optional(),
  originalName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  // Per-upload size ceiling; the module also clamps to the configured maxBytes.
  declaredBytes: z.number().int().positive().optional()
});

export const completeUploadInputSchema = z.object({
  ticketId: z.string().min(1),
  tenantId: z.string().min(1)
});

export const listFilesFilterSchema = z.object({
  tenantId: z.string().min(1),
  ownerId: z.string().min(1).nullable().optional(),
  status: z.enum(["active", "deleted"]).default("active"),
  limit: z.number().int().positive().max(500).default(100)
});

export const deleteFileInputSchema = z.object({
  fileId: z.string().min(1),
  tenantId: z.string().min(1)
});

export type CreateUploadTicketInput = z.infer<typeof createUploadTicketInputSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadInputSchema>;
export type ListFilesFilter = z.infer<typeof listFilesFilterSchema>;
export type DeleteFileInput = z.infer<typeof deleteFileInputSchema>;
