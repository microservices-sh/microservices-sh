import { supportInboxConfigSchema } from "../schemas";

export const configSchema = supportInboxConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
