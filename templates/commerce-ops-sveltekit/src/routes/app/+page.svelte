<script lang="ts">
  import {
    PageHeader,
    MetricStrip,
    Card,
    Badge,
    Button,
    WorkflowTimeline,
    ActionRail,
    EmptyState
  } from "$lib/ui";
  import type { Metric, RailAction } from "$lib/ui/types";

  let { data } = $props();
  const m = $derived(data.metrics);

  const metrics = $derived<Metric[]>([
    {
      label: "Outstanding",
      value: m.outstanding,
      href: "/app/invoices",
      tone: m.outstandingOpenCount > 0 ? "warn" : "good",
      hint: `${m.outstandingOpenCount} open invoice${m.outstandingOpenCount === 1 ? "" : "s"}`
    },
    {
      label: "Overdue",
      value: m.overdueCount,
      href: "/app/invoices",
      tone: m.overdueCount > 0 ? "bad" : "good",
      hint: m.overdueCount > 0 ? m.overdueAmount : "all current"
    },
    {
      label: "Collected",
      value: m.collected,
      href: "/app/payments",
      tone: "good",
      hint: "paid to date"
    },
    {
      label: "Open tickets",
      value: m.openTicketCount,
      href: "/app/support",
      tone: m.openTicketCount > 0 ? "warn" : "good",
      hint: m.openTicketCount > 0 ? "needs attention" : "all clear"
    },
    {
      label: "Customers",
      value: m.customerCount,
      href: "/app/customers",
      tone: "neutral",
      hint: `${m.memberCount} team member${m.memberCount === 1 ? "" : "s"}`
    }
  ]);

  const actions = $derived<RailAction[]>(
    [
      m.overdueCount > 0
        ? {
            label: "Chase overdue invoices",
            description: `${m.overdueCount} past due · ${m.overdueAmount}`,
            href: "/app/invoices",
            primary: true
          }
        : null,
      { label: "Create an invoice", description: "Bill a customer", href: "/app/invoices/new" },
      m.openTicketCount > 0
        ? { label: "Triage support tickets", description: `${m.openTicketCount} open`, href: "/app/support" }
        : null,
      { label: "Add a customer", description: "Start a new relationship", href: "/app/customers" }
    ].filter(Boolean) as RailAction[]
  );

  const priorityTone = (p: string) => (p === "urgent" || p === "high" ? "bad" : p === "low" ? "neutral" : "warn");
</script>

<svelte:head>
  <title>Operations · Commerce Ops</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Company operations"
    title="Operations"
    description="What needs attention right now — scoped to your company and gated by your role."
  >
    {#snippet actions()}
      <Button href="/app/invoices/new" variant="primary">New invoice</Button>
    {/snippet}
  </PageHeader>

  <MetricStrip {metrics} />

  <div class="grid">
    <div class="grid__main">
      <Card title="Overdue invoices">
        {#snippet header()}
          {#if m.overdueCount > 0}<Badge tone="bad">{m.overdueCount} past due</Badge>{/if}
        {/snippet}
        {#if data.overdue.length === 0}
          <EmptyState title="Nothing overdue" description="Every issued invoice is within terms." />
        {:else}
          <ul class="list">
            {#each data.overdue as inv (inv.id)}
              <li class="list-item row-item">
                <div>
                  <a href={`/app/customers/${inv.customerId}`}>{inv.customerName}</a>
                  <p>Invoice {inv.number} · due {inv.due}</p>
                </div>
                <Badge tone="bad">{inv.balance}</Badge>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <Card title="Open tickets" class="stack">
        {#snippet header()}
          {#if m.openTicketCount > 0}<Badge tone="warn">{m.openTicketCount} open</Badge>{/if}
        {/snippet}
        {#if data.tickets.length === 0}
          <EmptyState title="No open tickets" description="Support queue is clear." />
        {:else}
          <ul class="list">
            {#each data.tickets as t (t.id)}
              <li class="list-item row-item">
                <div>
                  <a href="/app/support">{t.subject}</a>
                  <p>{t.requesterEmail} · {t.age}</p>
                </div>
                <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <ActionRail actions={actions} title="Next actions" />

      <Card title="Recent activity" class="stack">
        <WorkflowTimeline events={data.activity} emptyLabel="No activity yet — create an invoice or customer." />
      </Card>

      {#if data.notifications.length > 0}
        <Card title="Unread notifications" class="stack">
          {#snippet header()}<Badge tone="info">{m.unreadCount}</Badge>{/snippet}
          <ul class="list">
            {#each data.notifications as n (n.id)}
              <li class="list-item">
                <strong class="notif__title">{n.title}</strong>
                {#if n.body}<p>{n.body}</p>{/if}
                <span class="notif__time">{n.time}</span>
              </li>
            {/each}
          </ul>
        </Card>
      {/if}
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 22px;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
    align-items: start;
  }
  .grid__main,
  .grid__side {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .notif__title {
    display: block;
    font-size: 0.9rem;
    color: var(--color-ink);
  }
  .notif__time {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-faint);
  }
  :global(.card.stack) {
    margin: 0;
  }
</style>
