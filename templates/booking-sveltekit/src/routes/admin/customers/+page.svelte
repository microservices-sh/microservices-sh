<script lang="ts">
  import { Button, Panel, Eyebrow } from "$lib/components";

  let { data } = $props();
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Admin</Eyebrow>
      <h1>Customers.</h1>
      <p>Review customer records created by the booking flow through the customer module.</p>
      <p><Button href="/admin" variant="secondary">Back to overview</Button></p>
    </section>

    <Panel>
      <h2>All customers</h2>
      {#if data.customers.length === 0}
        <p>No customers yet.</p>
      {:else}
        <ul class="list">
          {#each data.customers as customer}
            <li class="list-item row-item">
              <div>
                <a href={`/admin/customers/${customer.id}`}><strong>{customer.name}</strong></a>
                <p>{customer.email}</p>
              </div>
              <span>Updated {new Date(customer.updatedAt).toLocaleDateString()}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>
  </div>
</main>
