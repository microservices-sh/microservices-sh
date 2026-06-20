<script lang="ts">
  // Interactive wrapper for the notifications-inapp module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). No live backend — the demo runs
  // client-side and mirrors the real use cases: notify (notification.created,
  // per-user + polymorphic payload), markRead / markAllRead (notification.read).
  // The Preview derives the unread count exactly as getUnreadCount does.
  import Preview from "@microservices-sh/notifications-inapp/preview";

  let { module: m }: { module: any } = $props();

  // Per-type sample payloads — title/body the host supplies when translating a
  // domain event into a per-user notify() call.
  const TEMPLATES: Record<string, { title: string; body: string }> = {
    "booking.confirmed": { title: "Booking confirmed", body: "Strategy session · Tue 11:00 AM with Grace Hopper" },
    "payment.received": { title: "Payment received", body: "$1,305.00 from Globex Corp" },
    "mention": { title: "You were mentioned", body: "Rae: “can you take a look at INV-0007?”" },
    "ticket.replied": { title: "Ticket reply", body: "Re: Can't export my report to CSV" }
  };

  let seq = 1;
  const at = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();
  let notifications = $state<any[]>([
    { id: `nt_${seq++}`, type: "payment.received", title: "Payment received", body: "$1,305.00 from Globex Corp", readAt: null, createdAt: at(3) },
    { id: `nt_${seq++}`, type: "mention", title: "You were mentioned", body: "Rae: “can you take a look at INV-0007?”", readAt: null, createdAt: at(28) },
    { id: `nt_${seq++}`, type: "booking.confirmed", title: "Booking confirmed", body: "Strategy session · Tue 11:00 AM with Grace Hopper", readAt: at(90), createdAt: at(140) }
  ]);

  function onnotify(type: string) {
    // notify → notification.created (one recipient, polymorphic type + payload)
    const tpl = TEMPLATES[type] ?? { title: type, body: "" };
    notifications = [{ id: `nt_${seq++}`, type, title: tpl.title, body: tpl.body, readAt: null, createdAt: new Date().toISOString() }, ...notifications];
  }
  function onread(id: string) {
    // markRead → notification.read
    notifications = notifications.map((n) => (n.id === id && n.readAt === null ? { ...n, readAt: new Date().toISOString() } : n));
  }
  function onreadall() {
    // markAllRead → notification.read
    const now = new Date().toISOString();
    notifications = notifications.map((n) => (n.readAt === null ? { ...n, readAt: now } : n));
  }
</script>

<Preview {notifications} {onnotify} {onread} {onreadall} />
