<script lang="ts">
  // Home page content is data — edit src/content.json (see content.schema.json
  // for the contract and CLAUDE.md for the playbook). Shape is enforced by
  // `npm run validate`, which gates `npm run build`, so this assertion is sound.
  import content from "../content.json";
  import type { SiteContent } from "../content.types";

  const c = content as SiteContent;
</script>

<main class="hero">
  <div class="hero-grid">
    <section>
      <p class="eyebrow">{c.hero.eyebrow}</p>
      <h1>{c.hero.headline}</h1>
      <p>{c.hero.lead}</p>
      <div class="nav">
        <a class="button" href={c.hero.primaryCta.href}>{c.hero.primaryCta.label}</a>
        <a class="button secondary" href={c.hero.secondaryCta.href}>{c.hero.secondaryCta.label}</a>
      </div>
    </section>

    <aside class="panel" aria-label="Highlights">
      <p class="eyebrow">{c.panel.eyebrow}</p>
      <h2>{c.panel.title}</h2>
      <p>{c.panel.body}</p>
      <ul class="list mt-6" role="list">
        {#each c.panel.features as feature}
          <li class="list-item flex items-center gap-2.5">
            <span class="text-accent font-semibold" aria-hidden="true">✓</span>
            {feature}
          </li>
        {/each}
      </ul>
    </aside>
  </div>
</main>
