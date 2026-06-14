# Detached API Boundary

The template must not put business logic directly in SvelteKit API routes.

## Layers

| Layer | Owns | Example |
|-------|------|---------|
| Route adapter | HTTP parsing and response mapping | `src/routes/api/bookings/+server.ts` |
| Use case | domain orchestration | `createBooking` |
| Port | dependency contract | `BookingRepository` |
| Adapter | concrete infrastructure | `D1BookingRepository` |
| Hook | user customization | `beforeBookingCreate` |

## Route Adapter Shape

```ts
export const POST = async ({ request, locals, platform }) => {
  const result = await createBooking({
    input: await request.json(),
    actor: locals.user,
    deps: {
      bookingRepository: locals.bookingRepository,
      customerRepository: locals.customerRepository
    }
  });

  return toSvelteKitResponse(result);
};
```

## Use Case Shape

```ts
export async function createBooking(context: CreateBookingContext): Promise<CreateBookingResult> {
  // validate input
  // create or update customer through @microservices-sh/customer
  // load resource/service
  // calculate availability
  // create hold or booking
  // emit domain event
  // write audit record
  // return framework-neutral result
}
```

## Port Shape

```ts
export interface BookingRepository {
  findAvailability(input: AvailabilityQuery): Promise<AvailabilityResult>;
  createBooking(input: BookingCreateRecord): Promise<BookingRecord>;
  cancelBooking(id: string, input: CancelBookingInput): Promise<BookingRecord>;
}
```

The same use case should be callable from SvelteKit, Hono, MCP tools, tests, and future background jobs.
