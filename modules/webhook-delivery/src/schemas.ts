import { z } from "zod";

export const registerEndpointInputSchema = z.object({
  url: z.string().url(),
  eventNames: z.array(z.string().min(1)).default([])
});

export const deliverEventInputSchema = z.object({
  eventName: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({})
});

export const listDeliveriesFilterSchema = z.object({
  endpointId: z.string().optional(),
  status: z.enum(["delivered", "failed"]).optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export type RegisterEndpointInput = z.infer<typeof registerEndpointInputSchema>;
export type DeliverEventInput = z.infer<typeof deliverEventInputSchema>;
export type ListDeliveriesFilter = z.infer<typeof listDeliveriesFilterSchema>;
