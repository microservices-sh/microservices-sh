<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";

  let { children, data } = $props();
  const brand = $derived(data?.settings?.name ?? "Booking");

  const links = [
    { href: "/book", label: "Book" },
    { href: "/admin", label: "Admin" },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/customers", label: "Customers" }
  ];

  const isActive = (href: string, path: string) =>
    href === path || (href !== "/" && path.startsWith(href));
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href="/">
      <span class="brand-mark">ms</span>
      <span>{brand}</span>
    </a>
    <nav class="nav" aria-label="Primary">
      {#each links as link}
        <a
          href={link.href}
          aria-current={isActive(link.href, $page.url.pathname) ? "page" : undefined}
        >
          {link.label}
        </a>
      {/each}
    </nav>
  </header>

  {@render children()}

  <footer class="site-footer">
    <span>{brand} · SvelteKit on Cloudflare</span>
    <span>Detached booking module · D1 persistence</span>
  </footer>
</div>
