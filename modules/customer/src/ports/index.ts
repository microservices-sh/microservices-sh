import type { Customer, DomainEvent } from "../types";

export interface CustomerRepository {
  listCustomers(): Promise<Customer[]>;
  getCustomer(customerId: string): Promise<Customer | null>;
  findCustomerByEmail(email: string): Promise<Customer | null>;
  upsertCustomer(input: {
    name: string;
    email: string;
    phone?: string | null;
    notes?: string | null;
  }): Promise<Customer>;
  writeEvent(event: DomainEvent): Promise<void>;
}
