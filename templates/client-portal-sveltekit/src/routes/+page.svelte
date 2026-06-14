<svelte:head>
  <title>Client Portal</title>
</svelte:head>

<main class="hero">
  <div class="hero-grid">
    <section>
      <p class="eyebrow">Cloudflare-native client portal template</p>
      <h1>A secure portal for your clients.</h1>
      <p>
        A SvelteKit app shell where each logged-in customer sees their own invoices and
        documents, and your staff get an admin side. Invoice, file, and customer behavior
        live in detached, framework-neutral modules.
      </p>
      <div class="nav">
        <a class="button" href="/login">Sign in</a>
        <a class="button secondary" href="/portal">Open the portal</a>
      </div>
    </section>

    <aside class="panel" aria-label="Template status">
      <p class="eyebrow">Template core</p>
      <h2>Detached by default</h2>
      <p>
        SvelteKit routes parse requests and render UI. Billing, files, and account behavior
        live in framework-neutral use cases with D1, R2, and in-memory adapters.
      </p>
      <ul class="list mt-6" role="list">
        {#each ["Per-customer scoped data", "Two-step file uploads", "Atomic invoice numbering", "Upgrade lockfile"] as feature}
          <li class="list-item flex items-center gap-2.5">
            <span class="text-accent font-semibold" aria-hidden="true">✓</span>
            {feature}
          </li>
        {/each}
      </ul>
    </aside>
  </div>
</main>
