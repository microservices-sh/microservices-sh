import { recurringDocumentsConfigSchema } from "../schemas";

export const configSchema = recurringDocumentsConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  defaultCurrency: "USD",
  defaultPaymentTermsDays: 30
});
