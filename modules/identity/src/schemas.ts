import { z } from "zod";

// Input validation schemas for the identity surface. The use-cases themselves
// accept `unknown` and normalize defensively (so they stay framework-neutral and
// dependency-light); these schemas mirror that contract for callers/route adapters
// that prefer to validate at the edge.

export const requestLoginCodeInputSchema = z.object({
  email: z.email().min(3),
});

export const verifyLoginCodeInputSchema = z.object({
  email: z.email().min(3),
  code: z.string().min(1),
});

export const readSessionInputSchema = z.object({
  sessionId: z.string().min(1).nullable().optional(),
});

export const destroySessionInputSchema = z.object({
  sessionId: z.string().min(1).nullable().optional(),
});

export type RequestLoginCodeInput = z.infer<typeof requestLoginCodeInputSchema>;
export type VerifyLoginCodeInput = z.infer<typeof verifyLoginCodeInputSchema>;
export type ReadSessionInput = z.infer<typeof readSessionInputSchema>;
export type DestroySessionInput = z.infer<typeof destroySessionInputSchema>;
