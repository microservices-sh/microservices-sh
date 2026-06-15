import type { ProviderRegistry } from "./service";
import { createKieAiProvider } from "./adapters/kie-ai";
import { createGeminiProvider } from "./adapters/gemini";
import { createGptImageProvider } from "./adapters/gpt-image";

// Environment a host passes to wire providers. Only providers whose credentials
// are present get constructed, so the configured default transparently falls
// through to the next available one when a key is missing.
export interface ImageProviderEnv {
  KIEAI_API_KEY?: string;
  KIEAI_BASE_URL?: string;
  // Full Gemini generateContent endpoint (Vertex / AI-Gateway URL).
  GEMINI_ENDPOINT?: string;
  GEMINI_AUTH_TOKEN?: string;
  OPENAI_API_KEY?: string;
  GPT_IMAGE_BASE_URL?: string;
  GPT_IMAGE_MODEL?: string;
}

// Construct the provider registry from host env. Optional fetchImpl is injectable
// for testing the assembled providers end-to-end.
export function buildProviders(env: ImageProviderEnv, opts?: { fetchImpl?: typeof fetch }): ProviderRegistry {
  const registry: ProviderRegistry = {};
  const fetchImpl = opts?.fetchImpl;

  if (env.KIEAI_API_KEY) {
    registry["kie-ai"] = createKieAiProvider({ apiKey: env.KIEAI_API_KEY, baseUrl: env.KIEAI_BASE_URL, fetchImpl });
  }
  if (env.GEMINI_ENDPOINT) {
    registry.gemini = createGeminiProvider({
      endpoint: env.GEMINI_ENDPOINT,
      authHeader: env.GEMINI_AUTH_TOKEN ? { Authorization: `Bearer ${env.GEMINI_AUTH_TOKEN}` } : undefined,
      fetchImpl,
    });
  }
  if (env.OPENAI_API_KEY) {
    registry["gpt-image"] = createGptImageProvider({
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.GPT_IMAGE_BASE_URL,
      model: env.GPT_IMAGE_MODEL,
      fetchImpl,
    });
  }

  return registry;
}
