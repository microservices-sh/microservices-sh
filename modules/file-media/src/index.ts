export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { createUploadTicket } from "./use-cases/create-upload-ticket";
export { completeUpload } from "./use-cases/complete-upload";
export { expireStaleTickets } from "./use-cases/expire-stale-tickets";
export { deleteFile } from "./use-cases/delete-file";
export { listFiles } from "./use-cases/list-files";
export {
  createUploadTicketScoped,
  completeUploadScoped,
  listFilesScoped,
  deleteFileScoped,
  getFileScoped
} from "./use-cases/scoped";
// Re-export the auth primitive so consumers of the *Scoped use-cases have a
// validated way to build the AuthContext they require (plan 33).
export { authContext } from "@microservices-sh/connection-contract";
export type { AuthContext } from "@microservices-sh/connection-contract";
export { buildObjectKey, sanitizeFileName, keyBelongsToTenant } from "./keys";
export { createD1MediaStore } from "./adapters/d1-media-store";
export { createMemoryMediaStore } from "./adapters/memory-media-store";
export { createR2ObjectStorage } from "./adapters/r2-object-storage";
export { createMemoryObjectStorage } from "./adapters/memory-object-storage";
export type { MediaStore, ObjectStorage } from "./ports";
export type {
  MediaFile,
  MediaFileStatus,
  MediaFileFilter,
  UploadTicket,
  UploadTicketStatus,
  StoredObjectInfo
} from "./types";
