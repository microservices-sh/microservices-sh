<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { Button, Logo } from "$lib/ui";

  let { children, data } = $props();
  const brand = $derived(data?.settings?.name ?? "Booking");

  const links = [
    { href: "/book", label: "Book" },
    { href: "/admin", label: "Admin" },
    { href: "/admin/calendar", label: "Calendar" },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/membership-credits", label: "Credits" },
    { href: "/admin/customers", label: "Customers" }
  ];

  const isActive = (href: string, path: string) =>
    href === path || (href !== "/" && path.startsWith(href));

  let theme = $state<"light" | "dark">("light");

  $effect(() => {
    theme = (document.documentElement.dataset.theme as "light" | "dark") ?? "light";
  });

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      /* ignore */
    }
  }
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href="/">
      <Logo withWordmark={false} href={null} height={26} />
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
    <span>{brand} · SvelteKit on Cloudflare</span>
    <span>Detached booking module · D1 persistence</span>
  </footer>
</div>
