export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Actor {
  id: string;
  email?: string;
  isAdmin?: boolean;
}

export interface DomainEvent {
  eventName: "customer.created" | "customer.updated";
  entityType: "customer";
  entityId: string;
  payload: Record<string, unknown>;
}
