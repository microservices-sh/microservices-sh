<script lang="ts">
  import { Card, Eyebrow, Button, Field, Badge, Alert } from "$lib/ui";

  let { data, form } = $props();

  // Ticket status -> Badge tone. open = warn, pending = neutral,
  // resolved/closed = good.
  const tone = (status: string): "good" | "warn" | "bad" | "neutral" => {
    switch (status) {
      case "open":
        return "warn";
      case "pending":
        return "neutral";
      case "resolved":
      case "closed":
        return "good";
      default:
        return "neutral";
    }
  };
</script>

<svelte:head>
  <title>Support | DOT AI OS</title>
</svelte:head>

<main class="section">
  <Eyebrow>Support queue</Eyebrow>
  <h1>Support</h1>
  <p>Support tickets for your workspace, powered by the support-ticket module.</p>

  {#if form?.created}
    <Alert tone="success">Ticket opened.</Alert>
  {:else if form?.updated}
    <Alert tone="success">Ticket updated.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      <h2>Tickets</h2>
      {#if data.tickets.length > 0}
        <ul class="list" role="list">
          {#each data.tickets as ticket}
            <li class="list-item row-item">
              <span><strong>{ticket.subject}</strong> - {ticket.requesterEmail}</span>
              <span class="ticket-actions">
                <Badge tone={tone(ticket.status)}>{ticket.status}</Badge>
                <span>{ticket.priority}</span>
                {#if data.canManage}
                  <form method="POST" action="?/updateStatus" class="status-form">
                    <input type="hidden" name="id" value={ticket.id} />
                    <select name="status" aria-label="Ticket status" value={ticket.status}>
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <Button type="submit" size="sm">Update</Button>
                  </form>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p>No tickets yet.</p>
      {/if}
    </Card>

    {#if data.canManage}
      <Card>
        <h2>Open a ticket</h2>
        <form method="POST" action="?/create">
          <Field label="Subject" id="subject">
            <input id="subject" name="subject" required value={form?.values?.subject ?? ""} />
          </Field>
          <Field label="Requester email" id="requesterEmail">
            <input
              id="requesterEmail"
              name="requesterEmail"
              type="email"
              required
              value={form?.values?.requesterEmail ?? ""}
            />
          </Field>
          <Field label="Priority" id="priority">
            <select id="priority" name="priority" value={form?.values?.priority ?? "normal"}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field label="Description (optional)" id="description">
            <textarea id="description" name="description">{form?.values?.description ?? ""}</textarea>
          </Field>
          <Button type="submit" variant="primary">Open ticket</Button>
        </form>
      </Card>
    {/if}
  </div>
</main>

<style>
  .ticket-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .status-form {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .status-form select {
    min-block-size: 32px;
    inline-size: auto;
    padding-block: 0.25rem;
  }
</style>
