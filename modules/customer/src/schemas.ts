import { z } from "zod";

export const customerInputSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.email(),
  phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
});

export const customerIdSchema = z.object({
  id: z.string().min(1)
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerIdInput = z.infer<typeof customerIdSchema>;
