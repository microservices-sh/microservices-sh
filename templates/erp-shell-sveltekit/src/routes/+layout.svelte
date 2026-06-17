<script lang="ts">
  import "../app.css";
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

  // The /app and /admin trees render their own shell (left sidebar + topbar), so
  // the root chrome only wraps the public auth/setup pages.
  let inApp = $derived($page.url.pathname.startsWith("/app") || $page.url.pathname.startsWith("/admin"));
</script>

{#if inApp}
  {@render children()}
{:else}
  <div class="shell">
    <header class="topbar">
      <a class="brand" href={data.user ? "/app" : "/login"}>
        <span class="brand-mark">erp</span>
        <span>ERP Shell</span>
      </a>

      <nav class="nav" aria-label="Primary">
        {#if data.user}
          <a href="/app">Open app</a>
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
