# Agent Guide: Booking Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral.
2. Do not import SvelteKit, Hono, or app route code from `src/use-cases`.
3. Put persistence behind `BookingRepository`.
4. Put Cloudflare D1 behavior in `src/adapters/d1-booking-repository.ts`.
5. Use `@microservices-sh/customer` for customer create/list/read behavior.
6. Treat migrations, PII fields, payment/email side effects, and production deploy behavior as approval-gated.
7. Prefer config/hooks before overlays or forks.
8. Run `pnpm module:booking -- build` and the consuming template build after edits.
