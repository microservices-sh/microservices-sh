import { commerceSyncConfigSchema } from "../schemas";

export const configSchema = commerceSyncConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
