import type { MediaFile, MediaFileFilter, StoredObjectInfo, UploadTicket } from "../types";

export interface MediaStore {
  insertTicket(ticket: UploadTicket): Promise<void>;
  getTicket(id: string): Promise<UploadTicket | null>;
  updateTicket(ticket: UploadTicket): Promise<void>;
  // Pending tickets whose expiresAt <= now — drives orphan cleanup.
  listExpiredTickets(nowIso: string, limit: number): Promise<UploadTicket[]>;

  insertFile(file: MediaFile): Promise<void>;
  getFile(id: string): Promise<MediaFile | null>;
  updateFile(file: MediaFile): Promise<void>;
  listFiles(filter: MediaFileFilter): Promise<MediaFile[]>;
}

// Abstraction over R2 (or any object store). Upload bytes are streamed to the
// store by the host route via put(); the module owns validation and lifecycle.
export interface ObjectStorage {
  put(key: string, body: ReadableStream | ArrayBuffer | string, opts?: { contentType?: string }): Promise<void>;
  head(key: string): Promise<StoredObjectInfo | null>;
  delete(key: string): Promise<void>;
}
