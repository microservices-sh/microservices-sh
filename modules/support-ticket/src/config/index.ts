import type { z } from "zod";
import { supportTicketConfigSchema } from "../schemas";

export const configSchema = supportTicketConfigSchema;

export const defaultConfig = {
  defaultPriority: "normal",
  defaultListLimit: 100
} satisfies z.infer<typeof supportTicketConfigSchema>;
