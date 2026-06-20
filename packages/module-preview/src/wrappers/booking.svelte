<script lang="ts">
  // Interactive wrapper for the booking module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). Booking needs no live backend — the demo runs
  // entirely client-side: picking a slot creates a confirmed booking and emits the
  // domain events, mirroring the real use cases (createBooking / cancelBooking).
  import Preview from "@microservices-sh/booking/preview";

  let { module: m }: { module: any } = $props();

  const now = new Date();
  const at = (dayOffset: number, hour: number, min = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, min, 0, 0);
    return d.toISOString();
  };
  const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

  const services = [
    { id: "svc_consult", name: "Discovery consult", description: "Intro call", durationMinutes: 30, priceCents: 5000, currency: "USD" },
    { id: "svc_strategy", name: "Strategy session", description: "Deep-dive", durationMinutes: 60, priceCents: 15000, currency: "USD" },
    { id: "svc_audit", name: "Technical audit", description: "Codebase review", durationMinutes: 90, priceCents: 24000, currency: "USD" }
  ];

  // open slots per service (availability already excludes taken times)
  let availability = $state(
    [
      ...["svc_consult", "svc_strategy", "svc_audit"].flatMap((sid) =>
        [at(1, 10), at(1, 14), at(2, 11), at(3, 15)].map((s) => ({ serviceId: sid, startsAt: s, endsAt: plus(s, 60), available: true }))
      )
    ]
  );

  let bookings = $state<any[]>([
    { id: "bk_seed", serviceName: "Strategy session", customerName: "Grace Hopper", startsAt: at(2, 11), status: "confirmed" }
  ]);
  let seq = 1;

  function onbook(input: { serviceId: string; serviceName: string; startsAt: string; customerName: string }) {
    const id = `bk_${seq++}`;
    bookings = [{ id, serviceName: input.serviceName, customerName: input.customerName, startsAt: input.startsAt, status: "confirmed" }, ...bookings];
    // taking a slot removes it from availability (no double-booking) — emits booking.created + booking.confirmed
    availability = availability.map((a) => (a.serviceId === input.serviceId && a.startsAt === input.startsAt ? { ...a, available: false } : a));
  }
  function oncancel(id: string) {
    // cancelling frees the slot back up — emits booking.cancelled
    const b = bookings.find((x) => x.id === id);
    bookings = bookings.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x));
    if (b) availability = availability.map((a) => (a.startsAt === b.startsAt ? { ...a, available: true } : a));
  }
</script>

<Preview {services} {availability} {bookings} {onbook} {oncancel} />
