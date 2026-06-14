import type { ObjectStorage } from "../ports";
import type { StoredObjectInfo } from "../types";

// In-memory object store for local dev and tests. Sizes are derived from
// ArrayBuffer/string bodies; for streams the caller may pre-seed via setSize.
export function createMemoryObjectStorage(): ObjectStorage & { setSize: (key: string, info: StoredObjectInfo) => void } {
  const objects = new Map<string, StoredObjectInfo>();

  function measure(body: ReadableStream | ArrayBuffer | string): number | null {
    if (typeof body === "string") return new TextEncoder().encode(body).byteLength;
    if (body instanceof ArrayBuffer) return body.byteLength;
    return null; // stream: unknown without consuming it
  }

  return {
    setSize(key, info) {
      objects.set(key, info);
    },
    async put(key, body, opts) {
      const size = measure(body);
      objects.set(key, { size: size ?? objects.get(key)?.size ?? 0, contentType: opts?.contentType });
    },
    async head(key) {
      const info = objects.get(key);
      return info ? { ...info } : null;
    },
    async delete(key) {
      objects.delete(key);
    }
  };
}
