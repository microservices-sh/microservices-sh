<svelte:head>
  <title>SaaS Starter · Multi-tenant B2B on Cloudflare</title>
</svelte:head>

<main class="hero">
  <div class="hero-grid">
    <section>
      <p class="eyebrow">Cloudflare-native B2B SaaS template</p>
      <h1>Ship a multi-tenant SaaS, not boilerplate.</h1>
      <p>
        Sign up, create an organization, invite your team, and bill on a subscription —
        all on a SvelteKit app shell with detached module use cases for tenancy, RBAC,
        and billing.
      </p>
      <div class="nav">
        <a class="button" href="/signup">Create your organization</a>
        <a class="button secondary" href="/login">Log in</a>
      </div>
    </section>

    <aside class="panel" aria-label="Template status">
      <p class="eyebrow">What's inside</p>
      <h2>Tenancy by default</h2>
      <p>
        Org-scoped access is enforced through <code>authorize</code> and
        <code>resolvePermissions</code> from org-team-rbac — not a flat admin flag.
      </p>
      <ul class="list mt-6" role="list">
        {#each ["Org sign-up + membership", "Role-based team management", "Subscription plans + status", "Super-admin over all orgs", "Audit trail of changes"] as feature}
          <li class="list-item flex items-center gap-2.5">
            <span class="text-accent font-semibold" aria-hidden="true">✓</span>
            {feature}
          </li>
        {/each}
      </ul>
    </aside>
  </div>
</main>
