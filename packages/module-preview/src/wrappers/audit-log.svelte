<script lang="ts">
  // Interactive wrapper for the audit-log module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real use
  // cases: consumeEvent / recordEvent append a domain event from another module to
  // the append-only trail (audit.recorded); export emits audit.exported. The sample
  // events are the exact ones the other module previews emit, so the trail reads as
  // a real cross-module history.
  import Preview from "@microservices-sh/audit-log/preview";

  let { module: m }: { module: any } = $props();

  // Each "source" maps to a representative domain event that module emits.
  const TEMPLATES: Record<string, { eventName: string; entityType: string; entityId: string; actorId: string | null }> = {
    booking: { eventName: "booking.confirmed", entityType: "booking", entityId: "bk_8f2a", actorId: "user_ada" },
    payment: { eventName: "payment.succeeded", entityType: "payment", entityId: "pi_3hk9", actorId: null },
    invoice: { eventName: "invoice.issued", entityType: "invoice", entityId: "INV-0007", actorId: "user_grace" },
    "org-team-rbac": { eventName: "member.removed", entityType: "membership", entityId: "mem_19", actorId: "user_grace" },
    "billing-subscriptions": { eventName: "subscription.past_due", entityType: "subscription", entityId: "sub_42", actorId: null }
  };

  let seq = 1;
  const at = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();
  let events = $state<any[]>([
    { id: `ev_${seq++}`, eventName: "invoice.issued", actorId: "user_grace", entityType: "invoice", entityId: "INV-0006", source: "invoice", createdAt: at(42) },
    { id: `ev_${seq++}`, eventName: "payment.succeeded", actorId: null, entityType: "payment", entityId: "pi_2ab1", source: "payment", createdAt: at(40) },
    { id: `ev_${seq++}`, eventName: "member.joined", actorId: "user_alan", entityType: "membership", entityId: "mem_18", source: "org-team-rbac", createdAt: at(15) }
  ]);

  function onconsume(kind: string) {
    // consumeEvent → recordEvent → audit.recorded (append-only; newest first)
    const t = TEMPLATES[kind];
    if (!t) return;
    events = [{ id: `ev_${seq++}`, eventName: t.eventName, actorId: t.actorId, entityType: t.entityType, entityId: t.entityId, source: kind, createdAt: new Date().toISOString() }, ...events];
  }
  function onexport() {
    // exportEvents → audit.exported (no mutation — append-only trail is read out)
  }
</script>

<Preview {events} {onconsume} {onexport} />
