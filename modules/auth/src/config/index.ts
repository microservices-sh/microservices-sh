import { z } from "zod";

export const configSchema = z.object({
  defaultTtlSeconds: z.number().int().positive().max(3600).default(60),
  issuer: z.string().min(1).default("auth"),
  // JWKS cache hint (seconds) for verifier services.
  jwksCacheSeconds: z.number().int().nonnegative().default(300)
});

export const defaultConfig = {
  defaultTtlSeconds: 60,
  issuer: "auth",
  jwksCacheSeconds: 300
} satisfies z.infer<typeof configSchema>;
