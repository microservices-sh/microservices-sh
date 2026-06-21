import { projectProgressConfigSchema } from "../schemas";

export const configSchema = projectProgressConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
