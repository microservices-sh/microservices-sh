import { membershipCreditsConfigSchema } from "../schemas";

export const configSchema = membershipCreditsConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
