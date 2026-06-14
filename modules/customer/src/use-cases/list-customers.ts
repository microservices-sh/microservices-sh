import type { CustomerRepository } from "../ports";

export async function listCustomers(deps: { customerRepository: CustomerRepository }) {
  const customers = await deps.customerRepository.listCustomers();
  return {
    ok: true,
    status: 200,
    data: { customers }
  };
}
