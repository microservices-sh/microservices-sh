import type { ObjectStorage } from "../ports";
import type { StoredObject } from "../types";

function toArrayBuffer(body: ReadableStream | ArrayBuffer | Uint8Array | string): ArrayBuffer {
  if (typeof body === "string") return new TextEncoder().encode(body).buffer as ArrayBuffer;
  if (body instanceof Uint8Array) return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  if (body instanceof ArrayBuffer) return body;
  throw new Error("memory-object-storage: ReadableStream bodies are not supported in tests");
}

export function createMemoryObjectStorage(): ObjectStorage & { has(key: string): boolean } {
  const objects = new Map<string, { body: ArrayBuffer; contentType?: string }>();

  return {
    async put(key, body, opts) {
      objects.set(key, { body: toArrayBuffer(body), contentType: opts?.contentType });
    },
    async get(key): Promise<StoredObject | null> {
      const obj = objects.get(key);
      return obj ? { body: obj.body, contentType: obj.contentType } : null;
    },
    async head(key) {
      const obj = objects.get(key);
      return obj ? { size: obj.body.byteLength, contentType: obj.contentType } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
    has(key) {
      return objects.has(key);
    },
  };
}
