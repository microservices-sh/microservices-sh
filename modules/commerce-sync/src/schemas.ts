import { z } from "zod";

export const commerceSyncConfigSchema = z.object({
  enabled: z.boolean().default(true)
});

export const commerceSyncRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  data: z.record(z.unknown()).default({})
});
