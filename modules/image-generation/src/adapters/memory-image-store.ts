import type { ImageStore } from "../ports";
import type { GeneratedImage } from "../types";

export function createMemoryImageStore(): ImageStore {
  const images = new Map<string, GeneratedImage>();

  return {
    async insert(image) {
      images.set(image.id, { ...image });
    },
    async get(id) {
      const image = images.get(id);
      return image ? { ...image } : null;
    },
    async update(image) {
      if (images.has(image.id)) images.set(image.id, { ...image });
    },
    async list(filter) {
      return [...images.values()]
        .filter((img) => img.tenantId === filter.tenantId && img.status === (filter.status ?? "active"))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map((img) => ({ ...img }));
    },
  };
}
