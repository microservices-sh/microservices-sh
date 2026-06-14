<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";

  let { data, children } = $props();

  const customerLinks = [
    { href: "/portal", label: "Dashboard" },
    { href: "/portal/invoices", label: "Invoices" },
    { href: "/portal/files", label: "Files" }
  ];

  const staffLinks = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/customers", label: "Customers" }
  ];

  const links = $derived(data.user?.role === "staff" ? staffLinks : customerLinks);

  const isActive = (href: string, path: string) =>
    href === path || (href !== "/" && path.startsWith(href));
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href="/">
      <span class="brand-mark">cp</span>
      <span>Client Portal</span>
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
      {#if data.user?.role === "staff"}
        <a href="/portal?role=customer">Customer view</a>
      {:else}
        <a href="/admin?role=staff">Staff view</a>
      {/if}
    </nav>
  </header>

  {@render children()}

  <footer class="site-footer">
    <span>Client Portal · SvelteKit on Cloudflare</span>
    <span>Detached invoice · file-media · customer modules</span>
  </footer>
</div>
