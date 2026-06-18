<script lang="ts">
  import { Card, Eyebrow, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Contacts · DOT AI OS</title>
</svelte:head>

<main class="section">
  <Eyebrow>Contact book</Eyebrow>
  <h1>Contacts</h1>
  <p>Customer, partner, and stakeholder records for your workspace, powered by the customer module.</p>

  {#if form?.created}
    <Alert tone="success">Contact saved.</Alert>
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
        <p>No contacts yet.</p>
      {/if}
    </Card>

    {#if data.canManage}
      <Card>
        <h2>Add a contact</h2>
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
          <Button type="submit" variant="primary">Save contact</Button>
        </form>
      </Card>
    {/if}
  </div>
</main>
