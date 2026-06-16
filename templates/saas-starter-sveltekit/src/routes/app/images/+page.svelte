<script lang="ts">
  import { Button, Field, Panel, StatusMessage, Eyebrow, Badge } from "$lib/components";

  let { data, form } = $props();

  const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
</script>

<svelte:head>
  <title>Image Studio · SaaS Starter</title>
</svelte:head>

<main class="section">
  <Eyebrow>Image generation</Eyebrow>
  <h1>Image Studio</h1>
  <p>Generate images from a prompt. Powered by the <code>@microservices-sh/image-generation</code> module (kie.ai / Gemini / GPT-image). With no provider keys configured, a deterministic stub provider is used so the flow works locally.</p>

  {#if form?.error}
    <StatusMessage variant="error" live>{form.error}</StatusMessage>
  {:else if form?.generated}
    <StatusMessage>Image generated.</StatusMessage>
  {:else if form?.deleted}
    <StatusMessage>Image deleted.</StatusMessage>
  {/if}

  <div class="content-grid mt-6">
    <Panel>
      <h2>Generate</h2>
      <form method="POST" action="?/generate">
        <Field label="Prompt" id="prompt">
          <textarea id="prompt" name="prompt" rows="3" placeholder="A red fox in a snowy forest, cinematic lighting" required></textarea>
        </Field>
        <Field label="Aspect ratio" id="aspectRatio">
          <select id="aspectRatio" name="aspectRatio">
            {#each ASPECT_RATIOS as ar}
              <option value={ar}>{ar}</option>
            {/each}
          </select>
        </Field>
        <Field label="Negative prompt (optional)" id="negativePrompt">
          <input id="negativePrompt" name="negativePrompt" placeholder="blurry, low quality" />
        </Field>
        <Button type="submit">Generate</Button>
      </form>
    </Panel>

    <Panel>
      <h2>Your images</h2>
      {#if data.images.length === 0}
        <p>No images yet. Generate your first one.</p>
      {:else}
        <ul class="list" role="list">
          {#each data.images as image (image.id)}
            <li class="list-item row-item">
              <img src={`/app/images/${image.id}`} alt={image.prompt} width="64" height="64" style="object-fit: cover; border-radius: 8px;" />
              <div>
                <strong>{image.prompt}</strong>
                <p><Badge>{image.provider}</Badge> <Badge>{image.aspectRatio}</Badge></p>
              </div>
              <form method="POST" action="?/delete">
                <input type="hidden" name="imageId" value={image.id} />
                <Button type="submit" variant="ghost">Delete</Button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>
  </div>
</main>
