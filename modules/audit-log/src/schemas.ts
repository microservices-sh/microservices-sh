import { z } from "zod";

export const recordEventInputSchema = z.object({
  eventName: z.string().min(1),
  actorId: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).default({})
});

export const listEventsFilterSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  eventName: z.string().optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export type RecordEventInput = z.infer<typeof recordEventInputSchema>;
export type ListEventsFilter = z.infer<typeof listEventsFilterSchema>;
