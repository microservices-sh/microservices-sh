// Image Generation domain types. A provider produces bytes; bytes live in R2 under
// a tenant-scoped key; metadata lives in D1. Editing produces a new image record.

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export type ImageProviderId = "kie-ai" | "gemini" | "gpt-image";

export type ImageStatus = "active" | "deleted";

export type ImageSource = "studio" | "agent" | "api";

// What a provider returns from generate()/edit().
export interface ProviderImageResult {
  imageBytes: Uint8Array;
  mimeType: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ProviderGenerateInput {
  prompt: string;
  aspectRatio: AspectRatio;
  negativePrompt?: string;
}

export interface ProviderEditInput {
  prompt: string;
  imageBytes: Uint8Array; // raw bytes of the source image to edit
  mimeType: string;
}

// A persisted gallery record. Object bytes are at `key` in the IMAGE_BUCKET.
export interface GeneratedImage {
  id: string;
  tenantId: string;
  prompt: string;
  negativePrompt: string | null;
  provider: ImageProviderId;
  aspectRatio: AspectRatio;
  key: string;
  mimeType: string;
  bytes: number;
  tokensUsed: number;
  source: ImageSource;
  status: ImageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedImageFilter {
  tenantId: string;
  status?: ImageStatus;
  limit?: number;
}

// Object bytes + content type read back from storage (for editing/serving).
export interface StoredObject {
  body: ArrayBuffer;
  contentType?: string;
}

export interface StoredObjectInfo {
  size: number;
  contentType?: string;
}
