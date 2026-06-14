import { z } from "zod";

export const createApiKeyInputSchema = z.object({
  workspace: z.string().min(1),
  project: z.string().min(1),
  subject: z.string().min(1),
  scopes: z.array(z.string().min(1)).default([])
});

export const issueTokenInputSchema = z.object({
  apiKey: z.string().min(8),
  // Optional subset of the key's grant; defaults to the full grant.
  scopes: z.array(z.string().min(1)).optional()
});

export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;
export type IssueTokenInput = z.infer<typeof issueTokenInputSchema>;
