import type { CalendarChannel, CalendarEvent } from "./types";

// Customization seam: inspect/skip a sync just before it runs. Return false to
// abort this sync run (e.g. tenant paused). Default pass-through.
export async function beforeCalendarSync(_connection: { tenantId: string; calendarId: string }): Promise<boolean> {
  return true;
}

// Customization seam: react to a newly inserted or changed event (e.g. mirror to
// booking, notify via email + jobs-workflows). Fired ONCE per real change —
// deduped events never reach here. Default no-op.
export async function onCalendarEventUpserted(_event: CalendarEvent): Promise<void> {
  return;
}

// Customization seam: react after a watch channel is renewed (e.g. audit-log).
// Default no-op.
export async function onChannelRenewed(_channel: CalendarChannel): Promise<void> {
  return;
}
