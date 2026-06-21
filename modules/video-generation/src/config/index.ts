import { videoGenerationConfigSchema } from "../schemas";

export const configSchema = videoGenerationConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
