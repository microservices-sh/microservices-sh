<script lang="ts">
  import { Card, Eyebrow, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Customers · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Customer book</Eyebrow>
  <h1>Customers</h1>
  <p>Customer records for your company, powered by the customer module.</p>

  {#if form?.created}
    <Alert tone="success">Customer saved.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      <h2>Directory</h2>
      {#if data.customers.length > 0}
        <ul class="list" role="list">
          {#each data.customers as customer}
            <li class="list-item row-item">
              <span><strong>{customer.name}</strong> · {customer.email}</span>
              <span>{customer.phone ?? ""}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p>No customers yet.</p>
      {/if}
    </Card>

    {#if data.canManage}
      <Card>
        <h2>Add a customer</h2>
        <form method="POST" action="?/create">
          <Field label="Name" id="name">
            <input id="name" name="name" required value={form?.values?.name ?? ""} />
          </Field>
          <Field label="Email" id="email">
            <input id="email" name="email" type="email" required value={form?.values?.email ?? ""} />
          </Field>
          <Field label="Phone (optional)" id="phone">
            <input id="phone" name="phone" value={form?.values?.phone ?? ""} />
          </Field>
          <Button type="submit" variant="primary">Save customer</Button>
        </form>
      </Card>
    {/if}
  </div>
</main>
