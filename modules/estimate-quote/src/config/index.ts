import { estimateQuoteConfigSchema } from "../schemas";

export const configSchema = estimateQuoteConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  defaultCurrency: "USD",
  quoteNumberPrefix: "EST",
  defaultExpiryDays: 30
});
