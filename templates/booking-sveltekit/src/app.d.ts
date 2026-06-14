import type { BookingRepository } from "@microservices-sh/booking/ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";

declare global {
  namespace App {
    interface Platform {
      env?: {
        DB?: D1Database;
        CACHE_KV?: KVNamespace;
        MICROSERVICES_TEMPLATE_ID?: string;
      };
    }

    interface Locals {
      bookingRepository: BookingRepository;
      customerRepository: CustomerRepository;
      user: { id: string; email: string; isAdmin: boolean } | null;
    }
  }
}

export {};
