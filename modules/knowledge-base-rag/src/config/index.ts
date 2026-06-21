import { knowledgeBaseRagConfigSchema } from "../schemas";

export const configSchema = knowledgeBaseRagConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
