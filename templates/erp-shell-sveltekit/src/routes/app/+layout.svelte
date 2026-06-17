<script lang="ts">
  import { page } from "$app/stores";
  import { Button } from "$lib/ui";

  let { data, children } = $props();

  let isDark = $state(false);
  $effect(() => {
    isDark = document.documentElement.dataset.theme === "dark";
  });

  function toggleTheme() {
    const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = n;
    localStorage.setItem("theme", n);
    isDark = n === "dark";
  }

  // Exact match for the dashboard root, prefix match for module sections.
  const isActive = (href: string, path: string) =>
    href === "/app" ? path === "/app" : path.startsWith(href);
</script>

<div class="erp-shell">
  <aside class="erp-sidebar" aria-label="Application">
    <a class="brand" href="/app">
      <span class="brand-mark">erp</span>
      <span>{data.activeOrg?.name ?? "ERP Shell"}</span>
    </a>

    <nav class="erp-nav" aria-label="Modules">
      {#each data.nav as item}
        <a
          class="erp-nav-link"
          href={item.href}
          aria-current={isActive(item.href, $page.url.pathname) ? "page" : undefined}
        >
          <span class="erp-nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}

      {#if data.user?.isSuperAdmin}
        <a
          class="erp-nav-link"
          href="/admin"
          aria-current={$page.url.pathname.startsWith("/admin") ? "page" : undefined}
        >
          <span class="erp-nav-icon" aria-hidden="true">⛨</span>
          <span>Admin console</span>
        </a>
      {/if}
    </nav>
  </aside>

  <div class="erp-main">
    <header class="erp-topbar">
      <span class="erp-topbar-org">{data.activeOrg?.name ?? "Set up your company"}</span>
      <div class="nav">
        <Button
          variant="ghost"
          size="sm"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={isDark}
          onclick={toggleTheme}
        >
          {isDark ? "☀" : "☾"}
        </Button>
        {#if data.user}
          <span class="erp-topbar-user">{data.user.email}</span>
          <form method="POST" action="/logout">
            <Button type="submit" variant="ghost" size="sm">Log out</Button>
          </form>
        {/if}
      </div>
    </header>

    <div class="erp-content">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .erp-shell {
    display: grid;
    grid-template-columns: 248px 1fr;
    min-height: 100vh;
  }
  .erp-sidebar {
    border-right: 1px solid var(--border, rgba(0, 0, 0, 0.08));
    padding: 1.25rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background: var(--surface, #fff);
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .erp-sidebar .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 600;
    text-decoration: none;
    color: inherit;
    padding: 0 0.4rem;
  }
  .brand-mark {
    display: inline-grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 0.6rem;
    background: var(--accent, #4f46e5);
    color: #fff;
    font-size: 0.7rem;
    letter-spacing: 0.03em;
  }
  .erp-nav {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .erp-nav-link {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.55rem 0.65rem;
    border-radius: 0.6rem;
    text-decoration: none;
    color: inherit;
    font-size: 0.92rem;
  }
  .erp-nav-link:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.04));
  }
  .erp-nav-link[aria-current="page"] {
    background: var(--accent-soft, rgba(79, 70, 229, 0.12));
    color: var(--accent, #4f46e5);
    font-weight: 600;
  }
  .erp-nav-icon {
    display: inline-grid;
    place-items: center;
    width: 1.4rem;
    opacity: 0.8;
  }
  .erp-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .erp-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.5rem;
    border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.08));
  }
  .erp-topbar-org {
    font-weight: 600;
  }
  .erp-topbar-user {
    font-size: 0.85rem;
    opacity: 0.75;
  }
  .erp-content {
    padding: 1.5rem;
  }
  @media (max-width: 720px) {
    .erp-shell {
      grid-template-columns: 1fr;
    }
    .erp-sidebar {
      position: static;
      height: auto;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
  }
</style>
