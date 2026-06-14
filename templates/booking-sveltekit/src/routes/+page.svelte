<main class="hero">
  <div class="hero-grid">
    <section>
      <p class="eyebrow">Cloudflare-native booking template</p>
      <h1>Start with a real booking app.</h1>
      <p>
        A SvelteKit app shell with detached booking logic, D1 persistence, module docs,
        and upgrade-plan boundaries for AI agents.
      </p>
      <div class="nav">
        <a class="button" href="/book">Create a booking</a>
        <a class="button secondary" href="/admin">View admin</a>
      </div>
    </section>

    <aside class="panel" aria-label="Template status">
      <p class="eyebrow">Template core</p>
      <h2>Detached by default</h2>
      <p>
        SvelteKit routes parse requests and render UI. Booking behavior lives in framework-neutral
        use cases with D1 and in-memory adapters.
      </p>
      <ul class="list mt-6" role="list">
        {#each ["D1-ready schema", "Thin API routes", "Upgrade lockfile"] as feature}
          <li class="list-item flex items-center gap-2.5">
            <span class="text-accent font-semibold" aria-hidden="true">✓</span>
            {feature}
          </li>
        {/each}
      </ul>
    </aside>
  </div>
</main>
