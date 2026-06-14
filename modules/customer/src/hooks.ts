import type { Customer } from "./types";
import type { CustomerInput } from "./schemas";

export async function beforeCustomerCreate(input: CustomerInput) {
  return {
    ...input,
    email: input.email.toLowerCase()
  };
}

export async function afterCustomerUpdated(input: { customer: Customer; created: boolean }) {
  return input;
}
