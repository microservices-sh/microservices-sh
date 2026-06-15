import type { ImageProvider } from "../ports";
import type {
  ImageProviderId,
  ProviderEditInput,
  ProviderGenerateInput,
  ProviderImageResult,
} from "../types";
import type { ImageGenerationConfig } from "../config";
import { ImageProviderError } from "../errors";

export type ProviderRegistry = Partial<Record<ImageProviderId, ImageProvider>>;
type FallbackConfig = Pick<ImageGenerationConfig, "defaultProvider" | "fallbackOrder">;

// Ordered list of providers to attempt: explicit override first (if available),
// else the configured default, then the fallback order — de-duplicated, and
// filtered to those actually wired (key present).
export function resolveProviderOrder(
  providers: ProviderRegistry,
  config: FallbackConfig,
  override?: ImageProviderId,
): ImageProviderId[] {
  const candidates = [override, config.defaultProvider, ...config.fallbackOrder].filter(
    (id): id is ImageProviderId => Boolean(id),
  );
  const seen = new Set<ImageProviderId>();
  const order: ImageProviderId[] = [];
  for (const id of candidates) {
    if (!seen.has(id) && providers[id]) {
      seen.add(id);
      order.push(id);
    }
  }
  return order;
}

// Try each resolved provider in order, advancing to the next only on a retryable
// error (429/5xx). Non-retryable errors abort immediately.
async function runWithFallback(
  providers: ProviderRegistry,
  config: FallbackConfig,
  override: ImageProviderId | undefined,
  run: (provider: ImageProvider) => Promise<ProviderImageResult>,
): Promise<ProviderImageResult & { provider: ImageProviderId }> {
  const order = resolveProviderOrder(providers, config, override);
  if (order.length === 0) {
    throw new ImageProviderError("No image provider is configured.", 503);
  }

  let lastError: unknown;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    try {
      const result = await run(providers[id]!);
      return { ...result, provider: id };
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ImageProviderError && err.retryable;
      const hasNext = i < order.length - 1;
      if (!retryable || !hasNext) throw err;
    }
  }
  throw lastError;
}

export function generateWithFallback(
  providers: ProviderRegistry,
  config: FallbackConfig,
  input: ProviderGenerateInput,
  override?: ImageProviderId,
): Promise<ProviderImageResult & { provider: ImageProviderId }> {
  return runWithFallback(providers, config, override, (p) => p.generate(input));
}

export function editWithFallback(
  providers: ProviderRegistry,
  config: FallbackConfig,
  input: ProviderEditInput,
  override?: ImageProviderId,
): Promise<ProviderImageResult & { provider: ImageProviderId }> {
  return runWithFallback(providers, config, override, (p) => p.edit(input));
}
