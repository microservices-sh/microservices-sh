export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { addTicketComment } from "./use-cases/add-ticket-comment";
export { attachTicketFile } from "./use-cases/attach-ticket-file";
export { createTicket } from "./use-cases/create-ticket";
export { createTicketShareToken } from "./use-cases/create-ticket-share-token";
export { getTicket } from "./use-cases/get-ticket";
export { listTicketShareTokens } from "./use-cases/list-ticket-share-tokens";
export { listTicketThread } from "./use-cases/list-ticket-thread";
export { listTickets } from "./use-cases/list-tickets";
export { resolveTicketShareToken } from "./use-cases/resolve-ticket-share-token";
export { revokeTicketShareToken } from "./use-cases/revoke-ticket-share-token";
export { updateTicket } from "./use-cases/update-ticket";
export {
  addTicketCommentScoped,
  attachTicketFileScoped,
  createTicketScoped,
  createTicketShareTokenScoped,
  getTicketScoped,
  listTicketShareTokensScoped,
  listTicketThreadScoped,
  listTicketsScoped,
  revokeTicketShareTokenScoped,
  updateTicketScoped
} from "./use-cases/scoped";
// Re-export the auth primitive so consumers of the *Scoped use-cases have a
// validated way to build the AuthContext they require (plan 33).
export { authContext } from "@microservices-sh/connection-contract";
export type { AuthContext } from "@microservices-sh/connection-contract";
export { createD1TicketStore } from "./adapters/d1-ticket-store";
export { createMemoryTicketStore } from "./adapters/memory-ticket-store";
export type { TicketStore } from "./ports";
export type {
  Actor,
  DomainEvent,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketCommentAuthorType,
  TicketFilter,
  TicketPriority,
  TicketPublicSnapshot,
  TicketShareToken,
  TicketStatus
} from "./types";

export const supportTicketModule = {
  id: "support-ticket",
  version: "0.1.0"
} as const;
