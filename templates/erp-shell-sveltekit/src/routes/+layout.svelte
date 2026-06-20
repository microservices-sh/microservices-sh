<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { Button, Logo } from "$lib/ui";

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

  // The /app and /admin trees render their own shell (left sidebar + topbar), so
  // the root chrome only wraps the public auth/setup pages.
  let inApp = $derived($page.url.pathname.startsWith("/app") || $page.url.pathname.startsWith("/admin"));
</script>

{#if inApp}
  {@render children()}
{:else}
  <div class="shell">
    <header class="topbar">
      <Logo href={data.user && data.hasCompanyAccess ? "/app" : "/login"} />

      <nav class="nav" aria-label="Primary">
        {#if data.user}
          {#if data.hasCompanyAccess}
            <a href="/app">Open app</a>
          {:else}
            <span class="nav-state" title="No workspace access">No access</span>
          {/if}
          <form method="POST" action="/logout">
            <Button type="submit" variant="ghost">Log out</Button>
          </form>
        {:else}
          <a href="/login">Log in</a>
        {/if}

        <Button
          variant="ghost"
          size="sm"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={isDark}
          onclick={toggleTheme}
        >
          {isDark ? "☀" : "☾"}
        </Button>
      </nav>
    </header>

    {@render children()}

    <footer class="site-footer">
      <span>ERP Shell · SvelteKit on Cloudflare</span>
      <span>Single company · RBAC · Plug-in modules</span>
    </footer>
  </div>
{/if}

<style>
  .nav-state {
    display: inline-flex;
    align-items: center;
    min-block-size: 32px;
    padding-inline: 10px;
    border: 1px solid rgb(202 138 4 / 0.28);
    border-radius: var(--radius-md);
    background: var(--color-amber-soft);
    color: var(--color-amber);
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }
</style>
