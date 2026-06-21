<script lang="ts">
  import { Alert, Badge, Button, Card, EmptyState, MetricStrip, PageHeader, ResourceTable } from "$lib/ui";
  import type { Metric, Tone } from "$lib/ui/types";

  let { data, form } = $props();

  const metrics = $derived<Metric[]>([
    { label: "Projects", value: data.metrics.total, tone: data.metrics.total > 0 ? "info" : "neutral", hint: "tracked work" },
    { label: "In progress", value: data.metrics.active, tone: data.metrics.active > 0 ? "warn" : "neutral", hint: "active timelines" },
    { label: "Planning", value: data.metrics.planning, tone: data.metrics.planning > 0 ? "info" : "neutral", hint: "not started" },
    { label: "Completed", value: data.metrics.completed, tone: data.metrics.completed > 0 ? "good" : "neutral", hint: "closed out" }
  ]);

  const statusFilters = [
    { id: "all", label: "All", href: "/app/project-progress" },
    { id: "planning", label: "Planning", href: "/app/project-progress?status=planning" },
    { id: "in_progress", label: "In progress", href: "/app/project-progress?status=in_progress" },
    { id: "on_hold", label: "On hold", href: "/app/project-progress?status=on_hold" },
    { id: "completed", label: "Completed", href: "/app/project-progress?status=completed" }
  ];

  function statusTone(status: string): Tone {
    switch (status) {
      case "completed":
        return "good";
      case "in_progress":
        return "warn";
      case "on_hold":
        return "bad";
      default:
        return "info";
    }
  }
</script>

<svelte:head>
  <title>Project Progress | ERP Shell</title>
</svelte:head>

<main class="section project-progress-page">
  <PageHeader
    eyebrow="Customer operations"
    title="Project progress"
    description="Customer-facing project timelines, worker access, and public progress snapshots powered by the project-progress module."
  >
    {#snippet actions()}
      {#if data.canManage}
        <Button href="/app/project-progress/new" variant="primary">New project</Button>
      {/if}
    {/snippet}
    {#snippet meta()}
      <Badge tone={data.status.status === "draft" ? "warn" : "good"}>{data.status.status}</Badge>
      <span>{data.status.id}</span>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="filter-row">
    {#each statusFilters as filter (filter.id)}
      <a class:active={data.activeStatus === filter.id && !data.activeCustomer} href={filter.href}>{filter.label}</a>
    {/each}
  </div>

  <Card title="Projects">
    {#snippet header()}
      <Badge tone="neutral">{data.projects.length}</Badge>
    {/snippet}

    {#if data.projects.length > 0}
      <ResourceTable class="flush" caption="Project progress list">
        {#snippet head()}
          <tr>
            <th>Project</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Target</th>
            <th>Updated</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.projects as project (project.id)}
          <tr>
            <td data-label="Project">
              <a class="table-primary" href={`/app/project-progress/${project.id}`}>{project.title}</a>
              <span class="table-muted">{project.location ?? "No location"}</span>
            </td>
            <td data-label="Customer">
              <a href={`/app/customers/${project.customerId}`}>{project.customerName}</a>
            </td>
            <td data-label="Status"><Badge tone={statusTone(project.status)}>{project.statusLabel}</Badge></td>
            <td data-label="Target" class="table-muted">{project.dueLabel}</td>
            <td data-label="Updated" class="table-muted">{project.updated || "just now"}</td>
            <td class="table-action">
              <Button href={`/app/project-progress/${project.id}`} size="sm" variant="ghost">Open</Button>
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else if data.canManage}
      <EmptyState title="No projects yet" description="Create a project to share progress updates with a customer.">
        {#snippet action()}
          <Button href="/app/project-progress/new" variant="primary">New project</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState title="No projects yet" description="Projects added by your team will appear here." />
    {/if}
  </Card>
</main>

<style>
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .filter-row a {
    min-block-size: 38px;
    display: inline-grid;
    place-items: center;
    padding-inline: 13px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    color: var(--color-ink-soft);
    text-decoration: none;
    font-size: 0.86rem;
    font-weight: 500;
  }
  .filter-row a.active {
    border-color: var(--color-act);
    color: var(--color-act);
  }
</style>
