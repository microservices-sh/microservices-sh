import { beforeCustomerCreate, afterCustomerUpdated } from "../hooks";
import { customerInputSchema } from "../schemas";
import type { CustomerRepository } from "../ports";
import type { Actor } from "../types";

export async function upsertCustomer(
  input: unknown,
  deps: {
    customerRepository: CustomerRepository;
    actor?: Actor | null;
  }
) {
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_CUSTOMER_INPUT",
        message: "Customer input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const draft = await beforeCustomerCreate(parsed.data);
  const existing = await deps.customerRepository.findCustomerByEmail(draft.email);
  const customer = await deps.customerRepository.upsertCustomer(draft);
  const created = !existing;
  const eventName = created ? "customer.created" : "customer.updated";

  await deps.customerRepository.writeEvent({
    eventName,
    entityType: "customer",
    entityId: customer.id,
    payload: {
      actorId: deps.actor?.id ?? null,
      customerId: customer.id,
      email: customer.email
    }
  });

  await afterCustomerUpdated({ customer, created });

  return {
    ok: true,
    status: created ? 201 : 200,
    data: { customer, created }
  };
}
