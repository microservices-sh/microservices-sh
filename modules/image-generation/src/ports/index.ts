import type {
  GeneratedImage,
  GeneratedImageFilter,
  ImageProviderId,
  ProviderEditInput,
  ProviderGenerateInput,
  ProviderImageResult,
  StoredObject,
  StoredObjectInfo,
} from "../types";

// A pluggable image backend (kie.ai, Gemini, GPT-image, …). Adapters implement
// this; the module owns selection, fallback, storage and persistence.
export interface ImageProvider {
  readonly id: ImageProviderId;
  generate(input: ProviderGenerateInput): Promise<ProviderImageResult>;
  edit(input: ProviderEditInput): Promise<ProviderImageResult>;
}

// Persistence of gallery metadata (D1 or in-memory).
export interface ImageStore {
  insert(image: GeneratedImage): Promise<void>;
  get(id: string): Promise<GeneratedImage | null>;
  update(image: GeneratedImage): Promise<void>;
  list(filter: GeneratedImageFilter): Promise<GeneratedImage[]>;
}

// Abstraction over R2 (or any object store) for image bytes.
export interface ObjectStorage {
  put(key: string, body: ReadableStream | ArrayBuffer | Uint8Array | string, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<StoredObjectInfo | null>;
  delete(key: string): Promise<void>;
}
