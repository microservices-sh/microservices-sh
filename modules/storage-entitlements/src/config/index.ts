import { storageEntitlementsConfigSchema } from "../schemas";

export const configSchema = storageEntitlementsConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  defaultQuotaBytes: 2147483648,
  defaultCurrency: "USD"
});
