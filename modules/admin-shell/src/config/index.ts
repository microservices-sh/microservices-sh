import { z } from "zod";

export const configSchema = z.object({
  // Page size when a list query omits limit.
  defaultPageSize: z.number().int().positive().max(200).default(25),
  maxPageSize: z.number().int().positive().max(1000).default(100),
  // Require an explicit includeDeleted=true (and admin.write) to see soft-deleted rows.
  showDeletedByDefault: z.boolean().default(false)
});

export const defaultConfig = {
  defaultPageSize: 25,
  maxPageSize: 100,
  showDeletedByDefault: false
} satisfies z.infer<typeof configSchema>;
