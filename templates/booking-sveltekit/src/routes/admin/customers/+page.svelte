<script lang="ts">
  let { data } = $props();
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Admin</p>
      <h1>Customers.</h1>
      <p>Review customer records created by the booking flow through the customer module.</p>
      <p><a class="button secondary" href="/admin">Back to overview</a></p>
    </section>

    <section class="panel">
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
    </section>
  </div>
</main>
