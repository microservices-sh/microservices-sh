<script lang="ts">
  import { page } from "$app/stores";

  let { data, children } = $props();

  const path = $derived($page.url.pathname);
  function isActive(href: string): boolean {
    // Organization is the index — exact match only, so it isn't active on every
    // sub-page; the rest match their own subtree.
    if (href === "/app/settings") return path === "/app/settings";
    return path === href || path.startsWith(href + "/");
  }
</script>

<div class="settings-shell">
  <nav class="settings-nav" aria-label="Settings sections">
    {#each data.settingsNav as group (group.section)}
      <div class="settings-nav-group">
        <p class="settings-nav-title">{group.section}</p>
        {#each group.items as item (item.href)}
          <a href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>{item.label}</a>
        {/each}
      </div>
    {/each}
  </nav>

  <div class="settings-content">
    {@render children()}
  </div>
</div>

<style>
  .settings-shell {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 28px;
    align-items: start;
  }
  .settings-nav {
    position: sticky;
    top: 76px;
    display: grid;
    gap: 16px;
    padding-block: 32px 12px;
  }
  .settings-nav-group {
    display: grid;
    gap: 2px;
  }
  .settings-nav-title {
    margin: 0 0 4px;
    padding-inline: 10px;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }
  .settings-nav a {
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    color: var(--color-ink-soft);
    font-size: 0.875rem;
    text-decoration: none;
    transition: background 150ms var(--ease), color 150ms var(--ease);
  }
  .settings-nav a:hover {
    background: var(--color-panel-subtle);
    color: var(--color-ink);
  }
  .settings-nav a[aria-current="page"] {
    background: var(--color-green-soft);
    color: var(--color-green-dark);
    font-weight: 500;
  }
  .settings-content {
    min-inline-size: 0;
  }
  @media (max-width: 860px) {
    .settings-shell {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .settings-nav {
      position: static;
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      gap: 6px;
      padding-block: 16px 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .settings-nav::-webkit-scrollbar {
      display: none;
    }
    .settings-nav-group {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      align-items: center;
      gap: 6px;
    }
    .settings-nav-title {
      display: none;
    }
    .settings-nav a {
      white-space: nowrap;
      border: 1px solid var(--color-line);
    }
  }
</style>
