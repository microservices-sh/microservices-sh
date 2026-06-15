import type { ObjectStorage } from "../ports";
import type { StoredObject } from "../types";

// Cloudflare R2 implementation of the ObjectStorage port.
export function createR2ObjectStorage(bucket: R2Bucket): ObjectStorage {
  return {
    async put(key, body, opts) {
      await bucket.put(key, body, opts?.contentType ? { httpMetadata: { contentType: opts.contentType } } : undefined);
    },
    async get(key): Promise<StoredObject | null> {
      const object = await bucket.get(key);
      if (!object) return null;
      return { body: await object.arrayBuffer(), contentType: object.httpMetadata?.contentType };
    },
    async head(key) {
      const object = await bucket.head(key);
      if (!object) return null;
      return { size: object.size, contentType: object.httpMetadata?.contentType };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
