<script lang="ts">
  // Single source of truth: render the module's own DS-built surface. The same
  // Preview component is used by the standalone module-preview harness.
  import Preview from "@microservices-sh/marketing-research/preview";
  import { deserialize } from "$app/forms";

  let brief = $state<any>(null);
  let refused = $state<any>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function onrun(topic: string, channels: string[]) {
    busy = true;
    error = null;
    const fd = new FormData();
    fd.set("topic", topic);
    fd.set("channels", channels.join(","));
    const res = await fetch("?/run", { method: "POST", headers: { "x-sveltekit-action": "true" }, body: fd });
    const result = deserialize(await res.text());
    busy = false;
    if (result.type === "success") {
      brief = (result.data as any)?.brief ?? null;
      refused = (result.data as any)?.refused ?? null;
    } else if (result.type === "failure") {
      error = (result.data as any)?.error ?? "Something went wrong.";
      brief = null;
      refused = null;
    }
  }
</script>

<svelte:head><title>Marketing Research · SaaS Starter</title></svelte:head>

<main class="section">
  <Preview {brief} {refused} {busy} {onrun} />
  {#if error}
    <p class="mr-error">{error}</p>
  {/if}
</main>

<style>
  .mr-error { color: var(--color-amber); margin-top: 1rem; }
</style>
