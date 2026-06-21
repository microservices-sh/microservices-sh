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

  const isActive = (href: string, path: string) =>
    href === path || (href !== "/" && path.startsWith(href));

  const marketingLinks = [
    { href: "/", label: "Home" },
    { href: "/login", label: "Log in" },
    { href: "/signup", label: "Sign up" }
  ];

  const appLinks = [
    { href: "/app", label: "Dashboard" },
    { href: "/app/team", label: "Team" },
    { href: "/app/billing", label: "Billing" },
    { href: "/app/images", label: "Image Studio" },
    { href: "/app/ads", label: "Ads Manager" },
    { href: "/app/marketing-research", label: "Research" },
    { href: "/app/settings", label: "Settings" }
  ];

  let inApp = $derived($page.url.pathname.startsWith("/app") || $page.url.pathname.startsWith("/admin"));
  let links = $derived(data.user ? appLinks : marketingLinks);
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href={data.user ? "/app" : "/"}>
      <Logo withWordmark={false} href={null} height={26} />
      <span>SaaS Starter</span>
    </a>

    <nav class="nav" aria-label="Primary">
      {#each links as link}
        <a href={link.href} aria-current={isActive(link.href, $page.url.pathname) ? "page" : undefined}>
          {link.label}
        </a>
      {/each}

      {#if data.user && inApp && data.orgs.length > 0}
        <form method="POST" action="/app?/switchOrg" class="flex items-center gap-2">
          <select name="orgId" aria-label="Active organization" onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}>
            {#each data.orgs as org}
              <option value={org.id} selected={org.id === data.activeOrgId}>{org.name}</option>
            {/each}
          </select>
        </form>
      {/if}

      {#if data.user && data.user.isSuperAdmin}
        <a href="/admin" aria-current={isActive("/admin", $page.url.pathname) ? "page" : undefined}>Admin</a>
      {/if}

      {#if data.user}
        <form method="POST" action="/logout">
          <Button type="submit" variant="ghost">Log out</Button>
        </form>
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
    <span>SaaS Starter · SvelteKit on Cloudflare</span>
    <span>Multi-tenant orgs · RBAC · Subscription billing</span>
  </footer>
</div>
