<script lang="ts">
  import { PageHeader, Card, Button, Badge, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();
</script>

<svelte:head>
  <title>Customers · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Customer book"
    title="Customers"
    description="Customer records for your company, powered by the customer module."
  >
    {#snippet actions()}
      {#if data.canManage}
        <Button href="/app/customers/new" variant="primary">New customer</Button>
      {/if}
    {/snippet}
  </PageHeader>

  <Card title="Directory">
    {#snippet header()}
      <Badge tone="neutral">{data.customers.length}</Badge>
    {/snippet}

    {#if data.customers.length > 0}
      <ResourceTable class="flush" caption="Customer directory">
        {#snippet head()}
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.customers as customer (customer.id)}
          <tr>
            <td data-label="Name">
              <a class="table-primary" href={`/app/customers/${customer.id}`}>{customer.name}</a>
            </td>
            <td data-label="Email">{customer.email}</td>
            <td data-label="Phone" class="table-muted">{customer.phone ?? "—"}</td>
            <td class="row-go" aria-hidden="true">
              <a href={`/app/customers/${customer.id}`} tabindex="-1">→</a>
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else if data.canManage}
      <EmptyState title="No customers yet" description="Add your first customer to start billing and tracking work.">
        {#snippet action()}
          <Button href="/app/customers/new" variant="primary">New customer</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState title="No customers yet" description="Customers added by your team will appear here." />
    {/if}
  </Card>
</main>

<style>
  /* Trailing chevron column — row navigates to the customer detail page. */
  .row-go {
    text-align: end;
    inline-size: 1%;
    white-space: nowrap;
  }
  .row-go a {
    display: inline-block;
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    text-decoration: none;
    transition:
      transform 150ms var(--ease),
      color 150ms var(--ease);
  }
  :global(.resource-table tbody tr:hover) .row-go a {
    color: var(--color-act);
    transform: translateX(3px);
  }
</style>
