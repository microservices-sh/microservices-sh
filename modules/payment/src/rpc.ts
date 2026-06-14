import { createPaymentIntent } from "./use-cases/create-payment-intent";
import type { PaymentGateway, PaymentRepository } from "./ports";

// Framework-neutral RPC contract descriptor (plans/24). Service-mode codegen
// consumes this to emit a WorkerEntrypoint subclass: each entry becomes an RPC
// method, `scope` is enforced against the caller's token via the AUTH binding,
// and handlers share a uniform `(input, deps)` signature so the generated
// dispatcher needs no per-method casing.
export interface RpcDeps {
  paymentRepository: PaymentRepository;
  paymentGateway: PaymentGateway;
}

export interface RpcMethod {
  scope: string | null;
  public: boolean;
  description: string;
  handler: (input: unknown, deps: RpcDeps) => Promise<unknown>;
}

export const rpcContract: Record<string, RpcMethod> = {
  createPaymentIntent: {
    scope: "payment.write",
    public: false,
    description: "Create a payment intent through the gateway and record a pending payment.",
    handler: (input, deps) => createPaymentIntent(input, deps)
  }
};

export type RpcContract = typeof rpcContract;
