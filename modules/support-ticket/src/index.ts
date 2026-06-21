export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { createTicket } from "./use-cases/create-ticket";
export { getTicket } from "./use-cases/get-ticket";
export { listTickets } from "./use-cases/list-tickets";
export { updateTicket } from "./use-cases/update-ticket";
export { createTicketScoped, getTicketScoped, listTicketsScoped, updateTicketScoped } from "./use-cases/scoped";
export { draftTicketReply, draftTicketReplyScoped } from "./use-cases/draft-reply";
// Re-export the auth primitive so consumers of the *Scoped use-cases have a
// validated way to build the AuthContext they require (plan 33).
export { authContext } from "@microservices-sh/connection-contract";
export type { AuthContext } from "@microservices-sh/connection-contract";
export { createD1TicketStore } from "./adapters/d1-ticket-store";
export { createMemoryTicketStore } from "./adapters/memory-ticket-store";
export type { TicketStore, GroundedAnswerer } from "./ports";
export type {
  Actor,
  DomainEvent,
  Ticket,
  TicketFilter,
  TicketPriority,
  TicketStatus
} from "./types";

export const supportTicketModule = {
  id: "support-ticket",
  version: "0.1.0"
} as const;
