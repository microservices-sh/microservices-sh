import { z } from "zod";

export const ticketStatusSchema = z.enum(["open", "pending", "resolved", "closed"]);
export const ticketPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const createTicketInputSchema = z.object({
  tenantId: z.string().min(1),
  subject: z.string().min(1).max(200),
  description: z.string(),
  status: ticketStatusSchema.default("open"),
  priority: ticketPrioritySchema.default("normal"),
  requesterEmail: z.string().email(),
  assigneeId: z.string().min(1).optional().nullable()
});

export const ticketIdSchema = z.object({
  id: z.string().min(1)
});

export const listTicketsFilterSchema = z.object({
  tenantId: z.string().min(1),
  status: ticketStatusSchema.optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export const updateTicketInputSchema = z
  .object({
    id: z.string().min(1),
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    // null clears the assignment; undefined leaves it unchanged.
    assigneeId: z.string().min(1).nullable().optional()
  })
  .refine(
    (value) =>
      value.status !== undefined || value.priority !== undefined || value.assigneeId !== undefined,
    { message: "At least one of status, priority, or assigneeId must be provided." }
  );

// Used by the config schema; mirrors the module config surface.
export const supportTicketConfigSchema = z.object({
  defaultPriority: ticketPrioritySchema.default("normal"),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;
export type TicketIdInput = z.infer<typeof ticketIdSchema>;
export type ListTicketsFilter = z.infer<typeof listTicketsFilterSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;
export type SupportTicketConfig = z.infer<typeof supportTicketConfigSchema>;
