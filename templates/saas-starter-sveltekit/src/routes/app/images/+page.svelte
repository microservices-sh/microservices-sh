<script lang="ts">
  let { data, form } = $props();

  const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
</script>

<svelte:head>
  <title>Image Studio · SaaS Starter</title>
</svelte:head>

<main class="section">
  <p class="eyebrow">Image generation</p>
  <h1>Image Studio</h1>
  <p>Generate images from a prompt. Powered by the <code>@microservices-sh/image-generation</code> module (kie.ai / Gemini / GPT-image). With no provider keys configured, a deterministic stub provider is used so the flow works locally.</p>

  {#if form?.error}
    <div class="status error" aria-live="polite">{form.error}</div>
  {:else if form?.generated}
    <div class="status">Image generated.</div>
  {:else if form?.deleted}
    <div class="status">Image deleted.</div>
  {/if}

  <div class="content-grid mt-6">
    <section class="panel">
      <h2>Generate</h2>
      <form method="POST" action="?/generate" class="stack">
        <label>
          Prompt
          <textarea name="prompt" rows="3" placeholder="A red fox in a snowy forest, cinematic lighting" required></textarea>
        </label>
        <label>
          Aspect ratio
          <select name="aspectRatio">
            {#each ASPECT_RATIOS as ar}
              <option value={ar}>{ar}</option>
            {/each}
          </select>
        </label>
        <label>
          Negative prompt (optional)
          <input name="negativePrompt" placeholder="blurry, low quality" />
        </label>
        <button type="submit">Generate</button>
      </form>
    </section>

    <section class="panel">
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
                <p><span class="pill">{image.provider}</span> <span class="pill">{image.aspectRatio}</span></p>
              </div>
              <form method="POST" action="?/delete">
                <input type="hidden" name="imageId" value={image.id} />
                <button type="submit" class="ghost">Delete</button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>
