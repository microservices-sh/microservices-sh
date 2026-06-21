import { salesOrderConfigSchema } from "../schemas";

export const configSchema = salesOrderConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true, defaultCurrency: "USD" });
