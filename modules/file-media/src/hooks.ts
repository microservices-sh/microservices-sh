import { defaultConfig } from "./config";
import type { CreateUploadTicketInput } from "./schemas";
import type { MediaFile } from "./types";

// Customization seam: inspect/transform an upload request, or return null to
// reject it. Default is pass-through.
export async function beforeUpload(input: CreateUploadTicketInput): Promise<CreateUploadTicketInput | null> {
  return input;
}

// Customization seam: decide whether a content type is allowed. Default uses the
// configured allowlist. Override to widen/narrow per app.
export function allowContentType(contentType: string): boolean {
  return defaultConfig.allowedContentTypes.includes(contentType);
}

// Customization seam: react to a completed upload, e.g. enqueue image-variant
// jobs through jobs-workflows. Default is a no-op.
export async function onFileUploaded(_file: MediaFile): Promise<void> {
  return;
}
