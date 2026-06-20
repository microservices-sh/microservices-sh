<script lang="ts">
  // Generic module-preview harness. Inspects ONE module at a time (?module=<id>)
  // inside the canonical AppShell. Everything is auto-discovered — no per-module
  // code here:
  //   • module.json          → modules/<id>/module.json   (metadata + nav)
  //   • interactive wrapper   → wrappers/<id>.svelte       (demo data, run, config)
  //   • rich surface          → the wrapper imports modules/<id>/reference-ui/Preview.svelte
  // A module with no wrapper falls back to GenericPreview(module.json). Adding a
  // module needs zero edits to this file — drop the files in and it appears.
  import { AppShell } from "@microservices-sh/ui";
  import { onMount } from "svelte";
  import GenericPreview from "./GenericPreview.svelte";

  const metaGlob = import.meta.glob("../../../modules/*/module.json");
  const wrapperGlob = import.meta.glob("./wrappers/*.svelte");
  const metaId = (p: string) => p.match(/modules\/([^/]+)\//)?.[1] ?? p;
  const wrapId = (p: string) => p.match(/wrappers\/([^/]+)\.svelte$/)?.[1] ?? p;

  const ids = Object.keys(metaGlob).map(metaId).sort();
  const targetId = new URLSearchParams(location.search).get("module") ?? "marketing-research";

  let meta = $state<any>(null);
  let Wrapper = $state<any>(null);

  onMount(async () => {
    const me = Object.entries(metaGlob).find(([p]) => metaId(p) === targetId);
    if (me) meta = (await me[1]()).default;
    const we = Object.entries(wrapperGlob).find(([p]) => wrapId(p) === targetId);
    Wrapper = we ? (await (we[1] as any)()).default : null;
  });

  function switchModule(e: Event) {
    location.search = `?module=${(e.target as HTMLSelectElement).value}`;
  }

  const nav = $derived(
    meta
      ? [
          {
            section: meta.class ?? "module",
            items: (meta.surfaces?.admin?.nav?.length ? meta.surfaces.admin.nav : [{ label: meta.name }]).map((n: any) => ({ href: `#${meta.id}`, label: n.label }))
          }
        ]
      : []
  );
</script>

{#if meta}
  <AppShell {nav} pathname={`#${meta.id}`} brandHref="#" footer={{ title: meta.name, subtitle: meta.status }} status={`module preview · ${meta.id}`}>
    {#snippet actions()}
      <label class="mp-switch">
        <span>module</span>
        <select onchange={switchModule} value={targetId}>
          {#each ids as id}<option value={id}>{id}</option>{/each}
        </select>
      </label>
    {/snippet}

    {#key meta.id}
      {#if Wrapper}
        <Wrapper module={meta} />
      {:else}
        <GenericPreview module={meta} />
      {/if}
    {/key}
  </AppShell>
{/if}

<style>
  .mp-switch { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--color-ink-faint); }
  .mp-switch select { background: var(--color-panel); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 7px; padding: 0.3rem 0.5rem; font: inherit; font-size: 0.8rem; }
</style>
