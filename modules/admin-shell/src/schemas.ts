import { z } from "zod";

// Generic list-query parser. Per-resource value validation is handled by
// validateValues against the ResourceDefinition (values are dynamic by design).
export const listQuerySchema = z.object({
  search: z.string().max(200).optional(),
  filters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  sort: z
    .object({ column: z.string().min(1), direction: z.enum(["asc", "desc"]).default("asc") })
    .optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  includeDeleted: z.boolean().optional()
});

export const recordValuesSchema = z.record(z.unknown());

export type ListQueryInput = z.infer<typeof listQuerySchema>;
