const baseUrl = (process.argv[2] ?? process.env.MICROSERVICES_TEMPLATE_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");

async function fetchText(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return { response, text };
}

async function request(path, init) {
  const result = await fetchText(path, init);
  if (!result.response.ok) {
    throw new Error(`${path} returned ${result.response.status}: ${result.text.slice(0, 240)}`);
  }
  return result;
}

function assertIncludes(name, text, expected) {
  if (!text.includes(expected)) {
    throw new Error(`${name} did not include expected text: ${expected}`);
  }
}

const day = String((Math.floor(Date.now() / 1000) % 20) + 1).padStart(2, "0");
const hour = String((Math.floor(Date.now() / 1000) % 7) + 9).padStart(2, "0");
const startsAt = `2030-01-${day}T${hour}:00:00.000Z`;

function bookingPayload({ customerName, emailPrefix, customerPhone, notes }) {
  return {
    serviceId: "svc-standard",
    startsAt,
    customerName,
    customerEmail: `${emailPrefix}-${Date.now()}@example.com`,
    customerPhone,
    notes
  };
}

async function postBooking(payload, requestFn = request) {
  return requestFn("/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function createSmokeBooking() {
  const bookingResponse = await postBooking(
    bookingPayload({
      customerName: "HTTP Smoke",
      emailPrefix: "http-smoke",
      customerPhone: "+15555550126",
      notes: "HTTP smoke test"
    })
  );
  const bookingJson = JSON.parse(bookingResponse.text);
  const booking = bookingJson?.data?.booking;

  if (!booking?.id || !booking?.customerId) {
    throw new Error("Booking API did not return booking id and customer id.");
  }

  return booking;
}

async function assertDuplicateSlotRejected() {
  const duplicateBooking = await postBooking(
    bookingPayload({
      customerName: "HTTP Smoke Duplicate",
      emailPrefix: "http-smoke-duplicate",
      customerPhone: "+15555550127",
      notes: "HTTP smoke duplicate booking test"
    }),
    fetchText
  );

  if (duplicateBooking.response.status !== 409 || !duplicateBooking.text.includes("SLOT_UNAVAILABLE")) {
    throw new Error(
      `Duplicate booking expected 409 SLOT_UNAVAILABLE, got ${duplicateBooking.response.status}: ${duplicateBooking.text.slice(0, 240)}`
    );
  }
}

function printResult(booking, checks) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        baseUrl,
        bookingId: booking.id,
        customerId: booking.customerId,
        checks
      },
      null,
      2
    )}\n`
  );
}

function handleError(error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

async function main() {
  const checks = [];

  const home = await request("/");
  assertIncludes("home", home.text, "Start with a real booking app");
  checks.push({ id: "route:/", status: "pass" });

  const book = await request("/book");
  assertIncludes("book", book.text, "Confirm booking");
  checks.push({ id: "route:/book", status: "pass" });

  const availability = await request(`/api/availability?serviceId=svc-standard&date=${startsAt.slice(0, 10)}`);
  assertIncludes("availability", availability.text, "\"slots\"");
  checks.push({ id: "api:/api/availability", status: "pass" });

  const booking = await createSmokeBooking();
  checks.push({ id: "api:/api/bookings", status: "pass" });

  await assertDuplicateSlotRejected();
  checks.push({ id: "api:/api/bookings:duplicate-slot", status: "pass" });

  const admin = await request("/admin");
  assertIncludes("admin", admin.text, "HTTP Smoke");
  checks.push({ id: "route:/admin", status: "pass" });

  const bookings = await request("/admin/bookings");
  assertIncludes("admin bookings", bookings.text, "HTTP Smoke");
  checks.push({ id: "route:/admin/bookings", status: "pass" });

  const bookingDetail = await request(`/admin/bookings/${booking.id}`);
  assertIncludes("admin booking detail", bookingDetail.text, booking.id);
  checks.push({ id: "route:/admin/bookings/[id]", status: "pass" });

  const customers = await request("/admin/customers");
  assertIncludes("admin customers", customers.text, "HTTP Smoke");
  checks.push({ id: "route:/admin/customers", status: "pass" });

  const customerDetail = await request(`/admin/customers/${booking.customerId}`);
  assertIncludes("admin customer detail", customerDetail.text, booking.customerId);
  checks.push({ id: "route:/admin/customers/[id]", status: "pass" });

  printResult(booking, checks);
}

main().catch(handleError);
