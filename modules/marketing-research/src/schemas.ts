import { z } from "zod";

export const runResearchInputSchema = z.object({
  topic: z.string().min(1),
  channels: z.array(z.string().min(1)).optional()
});

export const getBriefInputSchema = z.object({
  briefId: z.string().min(1)
});

export const citationSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().min(1)
});

export const coverageSchema = z.object({
  searched: z.array(z.string()),
  returned: z.array(z.string()),
  note: z.string().optional()
});

export const marketingBriefSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  summary: z.string().min(1),
  implications: z.array(z.string()),
  citations: z.array(citationSchema),
  coverage: coverageSchema,
  ownerId: z.string().min(1),
  createdAt: z.string().datetime()
});

export type RunResearchInput = z.infer<typeof runResearchInputSchema>;
export type GetBriefInput = z.infer<typeof getBriefInputSchema>;
