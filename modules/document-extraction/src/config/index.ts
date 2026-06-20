import { documentExtractionConfigSchema } from "../schemas";

export const configSchema = documentExtractionConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  mode: "hybrid",
  reviewRequired: true,
  minConfidenceForApproval: 0.85,
  localBrowser: { enabled: true, downloadOnDemand: true, maxPages: 3 },
  gatewayFallback: { enabled: true, requiresApproval: true, minConfidence: 0.85 },
  sidecar: { enabled: false, endpoint: null }
});
