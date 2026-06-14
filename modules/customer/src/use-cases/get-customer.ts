import { customerIdSchema } from "../schemas";
import type { CustomerRepository } from "../ports";

export async function getCustomer(input: unknown, deps: { customerRepository: CustomerRepository }) {
  const parsed = customerIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_CUSTOMER_INPUT",
        message: "Customer lookup input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const customer = await deps.customerRepository.getCustomer(parsed.data.id);
  if (!customer) {
    return {
      ok: false,
      status: 404,
      error: {
        code: "CUSTOMER_NOT_FOUND",
        message: "Customer not found."
      }
    };
  }

  return {
    ok: true,
    status: 200,
    data: { customer }
  };
}
