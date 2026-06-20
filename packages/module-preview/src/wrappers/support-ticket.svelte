<script lang="ts">
  // Interactive wrapper for the support-ticket module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). No live backend — the demo runs
  // client-side and mirrors the real use cases: createTicket (created),
  // updateTicket assign/priority (updated), and a status change (status_changed
  // in addition to updated). Status is the open -> pending -> resolved -> closed
  // enum the module validates.
  import Preview from "@microservices-sh/support-ticket/preview";

  let { module: m }: { module: any } = $props();

  const agents = [
    { id: "ag_rae", name: "Rae Okafor" },
    { id: "ag_lin", name: "Lin Zhao" },
    { id: "ag_sam", name: "Sam Ortiz" }
  ];

  let seq = 1;
  let tickets = $state<any[]>([
    { id: `tk_${seq++}`, subject: "Payment failed but card was charged", description: "Charged twice on checkout; need a refund on one.", requesterEmail: "mara@globex.com", status: "open", priority: "urgent", assigneeId: "ag_rae" },
    { id: `tk_${seq++}`, subject: "How do I invite teammates?", description: "Can't find the seats page.", requesterEmail: "joe@initech.io", status: "pending", priority: "normal", assigneeId: "ag_lin" },
    { id: `tk_${seq++}`, subject: "Feature request: dark mode", description: "Would love a dark theme.", requesterEmail: "kit@hooli.xyz", status: "resolved", priority: "low", assigneeId: null }
  ]);

  function oncreate(t: { subject: string; requesterEmail: string; priority: string }) {
    // createTicket → support-ticket.created (new tickets start open + unassigned)
    tickets = [{ id: `tk_${seq++}`, subject: t.subject, description: "", requesterEmail: t.requesterEmail, status: "open", priority: t.priority, assigneeId: null }, ...tickets];
  }
  function onstatus(id: string, status: string) {
    // updateTicket status → support-ticket.status_changed + support-ticket.updated
    tickets = tickets.map((t) => (t.id === id ? { ...t, status } : t));
  }
  function onpriority(id: string, priority: string) {
    // updateTicket → support-ticket.updated
    tickets = tickets.map((t) => (t.id === id ? { ...t, priority } : t));
  }
  function onassign(id: string, assigneeId: string | null) {
    // updateTicket → support-ticket.updated
    tickets = tickets.map((t) => (t.id === id ? { ...t, assigneeId } : t));
  }
</script>

<Preview {agents} {tickets} {oncreate} {onstatus} {onpriority} {onassign} />
