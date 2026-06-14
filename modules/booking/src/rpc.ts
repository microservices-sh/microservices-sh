import { getAvailability } from "./use-cases/get-availability";
import { getBooking } from "./use-cases/get-booking";
import { listBookings } from "./use-cases/list-bookings";
import type { BookingRepository } from "./ports";

// Framework-neutral RPC contract descriptor (plans/24). Service-mode codegen
// consumes this to emit a WorkerEntrypoint subclass: each entry becomes an RPC
// method, `scope` is enforced against the caller's token via the AUTH binding,
// and handlers share a uniform `(input, deps)` signature.
//
// IMPORTANT (plans/24 service-scoped D1 rule): only booking's OWN-data use cases
// are exposed over RPC here. `createBooking` is intentionally NOT exposed — it
// depends on customer data and, in service mode, must call the customer service
// via an RPC-backed port rather than a local customer repository. That
// cross-service wiring is deferred; see plans/24 Implementation Status.
export interface RpcDeps {
  bookingRepository: BookingRepository;
}

export interface RpcMethod {
  scope: string | null;
  public: boolean;
  description: string;
  handler: (input: unknown, deps: RpcDeps) => Promise<unknown>;
}

export const rpcContract: Record<string, RpcMethod> = {
  listBookings: {
    scope: "booking.read",
    public: false,
    description: "List all bookings (booking's own data).",
    handler: (_input, deps) => listBookings(deps)
  },
  getBooking: {
    scope: "booking.read",
    public: false,
    description: "Fetch one booking by id (booking's own data).",
    handler: (input, deps) => getBooking(input as { id: string }, deps)
  },
  getAvailability: {
    scope: "booking.read",
    public: false,
    description: "Compute availability slots for a service/date (pure, booking's own data).",
    handler: (input, deps) => getAvailability(input, deps)
  }
};

export type RpcContract = typeof rpcContract;
