import type { Ticket } from "./types";
import type { CreateTicketInput } from "./schemas";

// Customization seam: normalize/inspect a ticket draft before it is created.
// Default normalizes the requester email to lower-case. Return the (possibly
// adjusted) input; the create use-case persists what this returns.
export async function beforeTicketCreate(input: CreateTicketInput): Promise<CreateTicketInput> {
  return {
    ...input,
    requesterEmail: input.requesterEmail.toLowerCase()
  };
}

// Customization seam: react after a ticket is updated (e.g. notify the requester,
// start an SLA timer). Default no-op pass-through.
export async function afterTicketUpdated(input: {
  ticket: Ticket;
  statusChanged: boolean;
}): Promise<{ ticket: Ticket; statusChanged: boolean }> {
  return input;
}
