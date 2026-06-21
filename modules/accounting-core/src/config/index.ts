import { accountingCoreConfigSchema } from "../schemas";

export const configSchema = accountingCoreConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true, defaultCurrency: "USD" });
