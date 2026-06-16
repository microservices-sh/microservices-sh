import { idempotencyConfigSchema } from "../schemas";

export const configSchema = idempotencyConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  defaultTtlMs: 86_400_000,
  defaultLockTtlMs: 60_000,
  maxTtlMs: 31_536_000_000
});
