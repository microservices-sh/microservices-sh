<script lang="ts">
  // Interactive wrapper for the image-generation module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). No live backend / model — the demo mirrors
  // the real use cases: generateImage (bytes → R2 at a tenant-scoped key, metadata →
  // D1, image.generated), editImage (a NEW record from an existing image,
  // image.edited), deleteImage (image.deleted). Thumbnails are deterministic
  // gradients from a seed — placeholders, never a faked provider result.
  import Preview from "@microservices-sh/image-generation/preview";

  let { module: m }: { module: any } = $props();

  const providers = [
    { id: "kie-ai", label: "kie.ai (nano-banana)" },
    { id: "gemini", label: "Gemini" },
    { id: "gpt-image", label: "GPT-image" }
  ];
  const aspects = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const defaultProvider = "kie-ai";

  const TENANT = "tenant_acme";
  let seq = 1;
  const seedFrom = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const key = (id: string) => `${TENANT}/images/${id}.png`;

  let images = $state<any[]>([
    { id: "im_seed1", prompt: "Isometric cloud datacenter, soft pastel, blueprint lines", provider: "kie-ai", aspectRatio: "16:9", key: key("im_seed1"), tokensUsed: 1280, source: "studio", status: "active", seed: seedFrom("datacenter") },
    { id: "im_seed2", prompt: "Minimal logo mark, koi + circuit, monoline", provider: "gemini", aspectRatio: "1:1", key: key("im_seed2"), tokensUsed: 940, source: "agent", status: "active", seed: seedFrom("koi") }
  ]);

  function ongenerate(input: { prompt: string; negativePrompt: string; aspectRatio: string; provider: string }) {
    // generateImage → image.generated (bytes → R2 tenant key, metadata → D1)
    const id = `im_${seq++}`;
    images = [
      { id, prompt: input.prompt, provider: input.provider, aspectRatio: input.aspectRatio, key: key(id), tokensUsed: 800 + (input.prompt.length % 700), source: "studio", status: "active", seed: seedFrom(input.prompt + input.provider) },
      ...images
    ];
  }
  function onedit(imageId: string) {
    // editImage → image.edited (produces a NEW record from the source image)
    const src = images.find((i) => i.id === imageId);
    if (!src) return;
    const id = `im_${seq++}`;
    images = [
      { ...src, id, key: key(id), prompt: `${src.prompt} · edited`, tokensUsed: src.tokensUsed + 220, seed: (src.seed * 13 + 97) >>> 0, edited: true, source: "studio" },
      ...images
    ];
  }
  function ondelete(imageId: string) {
    // deleteImage → image.deleted
    images = images.map((i) => (i.id === imageId ? { ...i, status: "deleted" } : i));
  }
</script>

<Preview {providers} {aspects} {images} {defaultProvider} {ongenerate} {onedit} {ondelete} />
