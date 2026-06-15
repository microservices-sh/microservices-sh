import type { GeneratedImage } from "./types";
import type { GenerateImageInput } from "./schemas";

// Customization seam: inspect/transform a generation request (e.g. inject a brand
// style suffix), or return null to skip generation. Default is pass-through.
export async function beforeGenerate(input: GenerateImageInput): Promise<GenerateImageInput | null> {
  return input;
}

// Customization seam: react to a completed generation, e.g. enqueue a thumbnail
// job or push to an ads-creative library. Default is a no-op.
export async function onImageGenerated(_image: GeneratedImage): Promise<void> {
  return;
}
