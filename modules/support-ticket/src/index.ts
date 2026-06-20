export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { createTicket } from "./use-cases/create-ticket";
export { getTicket } from "./use-cases/get-ticket";
export { listTickets } from "./use-cases/list-tickets";
export { updateTicket } from "./use-cases/update-ticket";
export { getTicketScoped, listTicketsScoped, updateTicketScoped } from "./use-cases/scoped";
export { createD1TicketStore } from "./adapters/d1-ticket-store";
export { createMemoryTicketStore } from "./adapters/memory-ticket-store";
export type { TicketStore } from "./ports";
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
