// Lifecycle: an UploadTicket is created first (intent), the bytes are stored at
// its tenant-scoped key, then completeUpload promotes it to a MediaFile. Tickets
// not completed before expiresAt are cleaned up so R2 never accumulates orphans.
export type UploadTicketStatus = "pending" | "completed" | "expired";

export interface UploadTicket {
  id: string;
  tenantId: string;
  /** Optional app-level owner, such as a customer id for client portals. */
  ownerId: string | null;
  // Tenant-prefixed object key: `${tenantId}/${id}/${safeName}`.
  key: string;
  contentType: string;
  originalName: string;
  maxBytes: number;
  status: UploadTicketStatus;
  expiresAt: string;
  createdAt: string;
}

export type MediaFileStatus = "active" | "deleted";

export interface MediaFile {
  id: string;
  tenantId: string;
  /** Optional app-level owner, such as a customer id for client portals. */
  ownerId: string | null;
  key: string;
  contentType: string;
  bytes: number;
  originalName: string;
  status: MediaFileStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFileFilter {
  tenantId: string;
  ownerId?: string | null;
  status?: MediaFileStatus;
  limit?: number;
}

// Metadata about a stored object, returned by ObjectStorage.head.
export interface StoredObjectInfo {
  size: number;
  contentType?: string;
}
