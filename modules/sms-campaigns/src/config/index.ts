import { smsCampaignsConfigSchema } from "../schemas";

export const configSchema = smsCampaignsConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
