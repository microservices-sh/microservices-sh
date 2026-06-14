import { getCustomer } from "./use-cases/get-customer";
import { listCustomers } from "./use-cases/list-customers";
import { upsertCustomer } from "./use-cases/upsert-customer";
import type { CustomerRepository } from "./ports";

// Framework-neutral RPC contract descriptor (plans/24). Service-mode codegen
// consumes this to emit a WorkerEntrypoint subclass: each entry becomes an RPC
// method, `scope` is enforced against the caller's token via the AUTH binding,
// and handlers share a uniform `(input, deps)` signature so the generated
// dispatcher needs no per-method casing.
export interface RpcDeps {
  customerRepository: CustomerRepository;
}

export interface RpcMethod {
  scope: string | null;
  public: boolean;
  description: string;
  handler: (input: unknown, deps: RpcDeps) => Promise<unknown>;
}

export const rpcContract: Record<string, RpcMethod> = {
  getCustomer: {
    scope: "customer.read",
    public: false,
    description: "Fetch one customer by id.",
    handler: (input, deps) => getCustomer(input, deps)
  },
  listCustomers: {
    scope: "customer.read",
    public: false,
    description: "List all customers.",
    handler: (_input, deps) => listCustomers(deps)
  },
  upsertCustomer: {
    scope: "customer.write",
    public: false,
    description: "Create or update a customer by email.",
    handler: (input, deps) => upsertCustomer(input, deps)
  }
};

export type RpcContract = typeof rpcContract;
