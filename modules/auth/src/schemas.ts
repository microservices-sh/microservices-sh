import { z } from "zod";

export const mintTokenInputSchema = z.object({
  subject: z.string().min(1),
  workspace: z.string().min(1),
  project: z.string().min(1),
  scopes: z.array(z.string().min(1)).default([]),
  ttlSeconds: z.number().int().positive().max(3600).default(60),
  issuer: z.string().min(1).default("auth")
});

export const verifyTokenInputSchema = z.object({
  token: z.string().min(1)
});

export type MintTokenInput = z.infer<typeof mintTokenInputSchema>;
export type VerifyTokenInput = z.infer<typeof verifyTokenInputSchema>;
