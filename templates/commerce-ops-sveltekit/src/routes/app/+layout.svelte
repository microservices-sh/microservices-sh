<script>
  import { page } from "$app/stores";
  import { AppShell, Button } from "$lib/ui";

  let { data, children } = $props();

  const companyName = $derived(data.activeOrg?.name ?? "Set up your company");
</script>

<AppShell
  nav={data.nav}
  pathname={$page.url.pathname}
  brandHref="/app"
  footer={{ title: companyName, subtitle: data.user?.email }}
  status={{
    role: data.activeOrg ? "company" : "setup",
    center: data.activeOrgId ?? undefined,
    right: "microservices.sh · erp"
  }}
>
  {#snippet crumbs()}
    <span class="mono">{companyName}</span>
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
