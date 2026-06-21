import { productCatalogConfigSchema } from "../schemas";

export const configSchema = productCatalogConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true, defaultCurrency: "USD" });
