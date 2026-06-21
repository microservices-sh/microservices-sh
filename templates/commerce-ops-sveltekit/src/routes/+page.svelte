<script lang="ts">
  // Home page content is data — edit src/content.json (see content.schema.json
  // for the contract and CLAUDE.md for the playbook). Shape is enforced by
  // `npm run validate`, which gates `npm run build`, so this assertion is sound.
  import content from "../content.json";
  import type { SiteContent } from "../content.types";
  import { Button, Card, Eyebrow } from "$lib/ui";

  const c = content as SiteContent;
</script>

<svelte:head>
  <title>Commerce Ops · Company operations on Cloudflare</title>
</svelte:head>

<main class="hero">
  <div class="hero-grid">
    <section>
      <Eyebrow>{c.hero.eyebrow}</Eyebrow>
      <h1>{c.hero.headline}</h1>
      <p>{c.hero.lead}</p>
      <div class="nav">
        <Button href={c.hero.primaryCta.href} variant="primary">{c.hero.primaryCta.label}</Button>
        <Button href={c.hero.secondaryCta.href} variant="ghost">{c.hero.secondaryCta.label}</Button>
      </div>
    </section>

    <Card>
      <Eyebrow>{c.panel.eyebrow}</Eyebrow>
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
    </Card>
  </div>
</main>
