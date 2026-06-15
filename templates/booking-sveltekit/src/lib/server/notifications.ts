// Booking notifications (revamp P3a): confirmation on create + reminders via cron.
// Best-effort — email failure never blocks a booking. Uses the email module's
// sendEmail use case with a console/Resend provider (see email-deps.ts).
import { sendEmail } from "@microservices-sh/email";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { bookingReminders } from "./db/schema";
import { getEmailDeps, type EmailEnv } from "./email-deps";

interface NotifiableBooking {
  id: string;
  status: string;
  startsAt: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
}

function fmt(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(iso));
}

export async function sendBookingConfirmation(opts: {
  d1: D1Database | undefined;
  env: EmailEnv | undefined;
  timezone: string;
  booking: NotifiableBooking;
}): Promise<void> {
  const { booking: b } = opts;
  if (!b.customerEmail) return;
  const { provider, emailRepository, from } = getEmailDeps(opts.d1, opts.env);
  const when = fmt(b.startsAt, opts.timezone);
  await sendEmail(
    {
      from,
      to: [b.customerEmail],
      subject: `Booking confirmed — ${b.serviceName}`,
      html: `<p>Hi ${b.customerName},</p><p>Your booking for <strong>${b.serviceName}</strong> on <strong>${when}</strong> is confirmed.</p><p>Reference: ${b.id}</p>`,
      text: `Hi ${b.customerName}, your ${b.serviceName} booking on ${when} is confirmed. Reference: ${b.id}`,
      idempotencyKey: `confirm:${b.id}`,
    },
    { provider, emailRepository },
  );
}

export async function sendDueReminders(opts: {
  d1: D1Database | undefined;
  env: EmailEnv | undefined;
  timezone: string;
  reminderHours: number;
  bookings: NotifiableBooking[];
  now?: number;
}): Promise<{ due: number; sent: number }> {
  const now = opts.now ?? Date.now();
  const windowMs = opts.reminderHours * 3_600_000;
  const due = opts.bookings.filter((b) => {
    if (b.status !== "confirmed" || !b.customerEmail) return false;
    const t = new Date(b.startsAt).getTime();
    return t > now && t - now <= windowMs;
  });

  const { provider, emailRepository, from } = getEmailDeps(opts.d1, opts.env);
  const db = opts.d1 ? getDb(opts.d1) : null;
  let sent = 0;

  for (const b of due) {
    if (db) {
      const already = await db.select().from(bookingReminders).where(eq(bookingReminders.bookingId, b.id)).get();
      if (already) continue;
    }
    const when = fmt(b.startsAt, opts.timezone);
    const result = await sendEmail(
      {
        from,
        to: [b.customerEmail],
        subject: `Reminder — ${b.serviceName} on ${when}`,
        html: `<p>Hi ${b.customerName},</p><p>A reminder for your <strong>${b.serviceName}</strong> booking on <strong>${when}</strong>.</p>`,
        text: `Reminder: your ${b.serviceName} booking is on ${when}.`,
        idempotencyKey: `remind:${b.id}`,
      },
      { provider, emailRepository },
    );
    if (result.ok) {
      sent++;
      if (db) await db.insert(bookingReminders).values({ bookingId: b.id, sentAt: new Date(now).toISOString() });
    }
  }

  return { due: due.length, sent };
}
