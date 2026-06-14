import { emailConfigSchema } from "../schemas";

export const configSchema = emailConfigSchema;
export const defaultConfig = configSchema.parse({});
