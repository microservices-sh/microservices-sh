import { contentCmsConfigSchema } from "../schemas";

export const configSchema = contentCmsConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
