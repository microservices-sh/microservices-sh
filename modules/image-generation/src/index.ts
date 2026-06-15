export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema, imageGenerationConfigSchema } from "./config";
export type { ImageGenerationConfig } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { beforeGenerate, onImageGenerated } from "./hooks";

// Use-cases
export { generateImage } from "./use-cases/generate-image";
export { editImage } from "./use-cases/edit-image";
export { listImages } from "./use-cases/list-images";
export { getImage } from "./use-cases/get-image";
export { deleteImage } from "./use-cases/delete-image";

// Service helpers
export { generateWithFallback, editWithFallback, resolveProviderOrder } from "./service";
export type { ProviderRegistry } from "./service";

// Host wiring
export { buildProviders } from "./wiring";
export type { ImageProviderEnv } from "./wiring";

// Keys / errors
export { buildImageKey, keyBelongsToTenant, extensionForMime } from "./keys";
export { ImageProviderError } from "./errors";

// Adapters
export { createMemoryImageStore } from "./adapters/memory-image-store";
export { createD1ImageStore } from "./adapters/d1-image-store";
export { createMemoryObjectStorage } from "./adapters/memory-object-storage";
export { createR2ObjectStorage } from "./adapters/r2-object-storage";
export { createMemoryImageProvider } from "./adapters/memory-image-provider";
export { createKieAiProvider } from "./adapters/kie-ai";
export { createGeminiProvider } from "./adapters/gemini";
export { createGptImageProvider } from "./adapters/gpt-image";

// Ports & types
export type { ImageProvider, ImageStore, ObjectStorage } from "./ports";
export type {
  AspectRatio,
  ImageProviderId,
  ImageStatus,
  ImageSource,
  GeneratedImage,
  GeneratedImageFilter,
  ProviderImageResult,
  ProviderGenerateInput,
  ProviderEditInput,
} from "./types";
