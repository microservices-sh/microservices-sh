import { urlShortenerConfigSchema } from "../schemas";

export const configSchema = urlShortenerConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  defaultCodeLength: 6,
  maxExpiryDays: 365
});
