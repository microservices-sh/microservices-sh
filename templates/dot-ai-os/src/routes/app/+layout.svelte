<script lang="ts">
  import { page } from "$app/stores";
  import { AppShell, Button } from "$lib/ui";

  let { data, children } = $props();

  const workspaceName = $derived(data.activeOrg?.name ?? "Set up your workspace");
</script>

<AppShell
  nav={data.nav}
  pathname={$page.url.pathname}
  brandHref="/app"
  footer={{ title: workspaceName, subtitle: data.user?.email }}
  status={{
    role: data.activeOrg ? "workspace" : "setup",
    center: data.activeOrgId ?? undefined,
    right: "microservices.sh · dot-ai-os"
  }}
>
  {#snippet crumbs()}
    <span class="mono">{workspaceName}</span>
  {/snippet}

  {#snippet actions()}
    {#if data.user}
      <form method="POST" action="/logout">
        <Button type="submit" variant="ghost" size="sm">Sign out</Button>
      </form>
    {/if}
  {/snippet}

  {@render children()}
</AppShell>
