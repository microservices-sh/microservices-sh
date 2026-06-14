<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href="/">
      <span class="brand-mark">ms</span>
      <span>Booking SvelteKit</span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/book">Book</a>
      <a href="/admin">Admin</a>
      <a href="/admin/bookings">Bookings</a>
      <a href="/admin/customers">Customers</a>
    </nav>
  </header>

  {@render children()}
</div>
