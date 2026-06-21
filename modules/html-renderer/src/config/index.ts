import { htmlRendererConfigSchema } from "../schemas";

export const configSchema = htmlRendererConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  defaultTtlSeconds: 2592000,
  minTtlSeconds: 60,
  maxTtlSeconds: 2592000,
  maxHtmlBytes: 26214400
});
