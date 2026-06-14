import type { ObjectStorage } from "../ports";

// Cloudflare R2 implementation of the ObjectStorage port.
export function createR2ObjectStorage(bucket: R2Bucket): ObjectStorage {
  return {
    async put(key, body, opts) {
      await bucket.put(key, body, opts?.contentType ? { httpMetadata: { contentType: opts.contentType } } : undefined);
    },
    async head(key) {
      const object = await bucket.head(key);
      if (!object) return null;
      return { size: object.size, contentType: object.httpMetadata?.contentType };
    },
    async delete(key) {
      await bucket.delete(key);
    }
  };
}
