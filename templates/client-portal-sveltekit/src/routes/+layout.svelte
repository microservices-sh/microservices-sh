<script lang="ts">
  import "../app.css";
  import { dev } from "$app/environment";
  import { page } from "$app/stores";
  import { Button, Logo } from "$lib/ui";

  let { data, children } = $props();

  let theme = $state("light");

  $effect(() => {
    theme = document.documentElement.dataset.theme ?? "light";
  });

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      // ignore (private mode / no storage)
    }
  }

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
      <Logo withWordmark={false} href={null} height={26} />
      <span>Client Portal</span>
    </a>
    <nav class="nav" aria-label="Primary">
      {#if data.user}
        {#each links as link}
          <a
            href={link.href}
            aria-current={isActive(link.href, $page.url.pathname) ? "page" : undefined}
          >
            {link.label}
          </a>
        {/each}
        {#if dev}
          {#if data.user.role === "staff"}
            <a href="/portal?role=customer">Customer view</a>
          {:else}
            <a href="/admin?role=staff">Staff view</a>
          {/if}
        {/if}
        <a href="/logout">Log out</a>
      {:else}
        <a href="/login">Sign in</a>
      {/if}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Toggle dark mode"
        onclick={toggleTheme}
      >
        {theme === "dark" ? "☀" : "☾"}
      </Button>
    </nav>
  </header>

  {@render children()}

  <footer class="site-footer">
    <span>Client Portal · SvelteKit on Cloudflare</span>
    <span>Detached invoice · file-media · customer modules</span>
  </footer>
</div>
