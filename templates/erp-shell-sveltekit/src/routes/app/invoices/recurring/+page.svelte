<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import { Alert, Badge, Button, Card, EmptyState, MetricStrip, PageHeader, ResourceTable } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  const when = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString() : "n/a";
  const created = $derived($page.url.searchParams.get("created"));
  const nowIso = new Date().toISOString();

  const activeCount = $derived(data.templates.filter((template) => template.status === "active").length);
  const dueCount = $derived(
    data.templates.filter((template) => template.status === "active" && template.nextInvoiceAt && template.nextInvoiceAt <= nowIso).length
  );
  const metrics = $derived<Metric[]>([
    { label: "Active", value: activeCount, tone: activeCount > 0 ? "good" : "neutral", hint: "templates" },
    { label: "Due", value: dueCount, tone: dueCount > 0 ? "warn" : "good", hint: "ready to generate" },
    { label: "Total", value: data.templates.length, tone: "neutral", hint: "recurring templates" }
  ]);

  function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "active":
        return "good";
      case "paused":
        return "warn";
      case "cancelled":
        return "bad";
      default:
        return "neutral";
    }
  }

  function frequencyLabel(template: { frequency: string; customDays: number | null }) {
    return template.frequency === "custom" && template.customDays ? `Every ${template.customDays} days` : template.frequency;
  }
</script>

<svelte:head>
  <title>Recurring invoices · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Billing automation"
    title="Recurring invoices"
    description="Create invoice templates that generate due invoices on a schedule."
  >
    {#snippet actions()}
      {#if data.canManage}
        <Button href="/app/invoices/recurring/new" variant="primary">New recurring invoice</Button>
      {/if}
      <Button href="/app/invoices" variant="ghost">Ledger</Button>
    {/snippet}
  </PageHeader>

  {#if data.error}
    <Alert tone="error">{data.error}</Alert>
  {:else if created}
    <Alert tone="success">Recurring invoice {created} created.</Alert>
  {:else if form?.statusUpdated}
    <Alert tone="success">Recurring invoice updated.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <Card title="Templates" class="mt-6">
    {#snippet header()}
      <Badge tone="neutral">{data.templates.length}</Badge>
    {/snippet}

    {#if data.templates.length > 0}
      <ResourceTable class="flush" caption="Recurring invoice templates">
        {#snippet head()}
          <tr>
            <th>Name</th>
            <th>Frequency</th>
            <th>Status</th>
            <th>Next</th>
            <th class="table-num">Total</th>
            <th class="table-num">Generated</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.templates as template (template.id)}
          <tr>
            <td data-label="Name">
              <div class="table-primary">{template.name}</div>
              <div class="table-muted">{template.customer} · {template.lineCount} lines</div>
            </td>
            <td data-label="Frequency">{frequencyLabel(template)}</td>
            <td data-label="Status"><Badge tone={statusTone(template.status)}>{template.status}</Badge></td>
            <td data-label="Next">{when(template.nextInvoiceAt)}</td>
            <td data-label="Total" class="table-num">{money(template.totalCents, template.currency)}</td>
            <td data-label="Generated" class="table-num">
              {template.invoicesGenerated}{#if template.maxOccurrences !== null}/{template.maxOccurrences}{/if}
            </td>
            <td class="table-action" data-label="Actions">
              {#if data.canManage && template.status === "active"}
                <form method="POST" action="?/updateStatus" use:enhance>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="status" value="paused" />
                  <Button type="submit" variant="ghost" size="sm">Pause</Button>
                </form>
              {:else if data.canManage && template.status === "paused"}
                <form method="POST" action="?/updateStatus" use:enhance>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="status" value="active" />
                  <Button type="submit" variant="ghost" size="sm">Resume</Button>
                </form>
              {/if}
              {#if data.canManage && (template.status === "active" || template.status === "paused")}
                <form method="POST" action="?/updateStatus" use:enhance>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                </form>
              {/if}
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else if data.canManage}
      <EmptyState title="No recurring invoices yet" description="Create a template to automate repeated billing.">
        {#snippet action()}
          <Button href="/app/invoices/recurring/new" variant="primary">New recurring invoice</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState title="No recurring invoices yet" description="Recurring invoice templates will appear here." />
    {/if}
  </Card>
</main>

<style>
  .table-action form {
    display: inline-flex;
  }
</style>
