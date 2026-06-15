import { z } from "zod";

export const imageGenerationConfigSchema = z.object({
  // Provider tried first. The host only wires providers whose API keys exist, so
  // an unconfigured default transparently falls through to the next available one.
  defaultProvider: z.enum(["kie-ai", "gemini", "gpt-image"]).default("kie-ai"),
  // Order of providers tried after the default on a retryable failure (429/5xx).
  fallbackOrder: z.array(z.enum(["kie-ai", "gemini", "gpt-image"])).default(["kie-ai", "gemini", "gpt-image"]),
  allowedAspectRatios: z
    .array(z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]))
    .default(["1:1", "3:4", "4:3", "9:16", "16:9"]),
  defaultListLimit: z.number().int().positive().max(500).default(100),
  // kie.ai is async: poll cadence + ceiling for the internal wait loop.
  kieAiPollIntervalMs: z.number().int().positive().default(2000),
  kieAiMaxPolls: z.number().int().positive().default(45),
});

export type ImageGenerationConfig = z.infer<typeof imageGenerationConfigSchema>;

export const defaultConfig: ImageGenerationConfig = {
  defaultProvider: "kie-ai",
  fallbackOrder: ["kie-ai", "gemini", "gpt-image"],
  allowedAspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
  defaultListLimit: 100,
  kieAiPollIntervalMs: 2000,
  kieAiMaxPolls: 45,
};

export const configSchema = imageGenerationConfigSchema;
