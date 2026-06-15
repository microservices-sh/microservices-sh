// Standalone playground for the image-generation module — a plain Cloudflare
// Worker (no framework) that mounts the module's use-cases with in-memory
// store/storage. The user's API key is sent per request and used only to build
// the provider for that call; nothing is persisted. Run: `wrangler dev`.
//
// Imports the module from source (relative) so the demo runs co-located without
// workspace resolution. Real consumers import "@microservices-sh/image-generation".
import {
  generateImage,
  editImage,
  getImage,
  buildImageKey,
  createMemoryImageStore,
  createMemoryObjectStorage,
  createMemoryImageProvider,
  createKieAiProvider,
  createGeminiProvider,
  createGptImageProvider,
  type ImageProvider,
  type ImageProviderId,
} from "../../src/index";
import { HTML } from "./ui";

const store = createMemoryImageStore();
const storage = createMemoryObjectStorage();
const TENANT = "demo";

interface GenerateBody {
  provider: "stub" | ImageProviderId;
  apiKey?: string;
  geminiEndpoint?: string;
  prompt: string;
  aspectRatio?: string;
  negativePrompt?: string;
  referenceImage?: string; // data URL for edit mode
}

function buildProvider(body: GenerateBody): ImageProvider {
  switch (body.provider) {
    case "kie-ai":
      return createKieAiProvider({ apiKey: body.apiKey ?? "" });
    case "gemini":
      return createGeminiProvider({
        endpoint: body.geminiEndpoint ?? "",
        authHeader: body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : undefined,
      });
    case "gpt-image":
      return createGptImageProvider({ apiKey: body.apiKey ?? "" });
    case "stub":
    default:
      return createMemoryImageProvider();
  }
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  const mimeType = match?.[1] ?? "image/png";
  const binary = atob(match?.[2] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

async function handleGenerate(req: Request): Promise<Response> {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: { message: "Invalid JSON body" } }, 400);
  }
  if (!body.prompt?.trim()) return json({ ok: false, error: { message: "Prompt is required" } }, 400);

  const provider = buildProvider(body);
  const providers = { [provider.id]: provider };

  try {
    if (body.referenceImage) {
      // Reference image → exercise the edit use-case (seed the source record first).
      const { bytes, mimeType } = decodeDataUrl(body.referenceImage);
      const sourceId = "img_" + crypto.randomUUID().slice(0, 16);
      const key = buildImageKey(TENANT, sourceId, mimeType);
      await storage.put(key, bytes, { contentType: mimeType });
      const now = new Date().toISOString();
      await store.insert({
        id: sourceId, tenantId: TENANT, prompt: "(uploaded reference)", negativePrompt: null,
        provider: provider.id, aspectRatio: "1:1", key, mimeType, bytes: bytes.byteLength,
        tokensUsed: 0, source: "api", status: "active", createdAt: now, updatedAt: now,
      });
      const res = await editImage(
        { tenantId: TENANT, sourceImageId: sourceId, prompt: body.prompt, provider: provider.id },
        { providers, store, storage },
      );
      return json(res, res.status);
    }

    const res = await generateImage(
      {
        tenantId: TENANT,
        prompt: body.prompt,
        aspectRatio: (body.aspectRatio as "1:1") ?? "1:1",
        negativePrompt: body.negativePrompt || undefined,
        provider: provider.id,
      },
      { providers, store, storage },
    );
    return json(res, res.status);
  } catch (e) {
    return json({ ok: false, error: { message: e instanceof Error ? e.message : "Generation failed" } }, 500);
  }
}

async function handleServe(id: string): Promise<Response> {
  const res = await getImage({ tenantId: TENANT, imageId: id }, { store });
  if (!res.ok) return new Response("Not found", { status: 404 });
  const obj = await storage.get(res.data.image.key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, { headers: { "Content-Type": obj.contentType || res.data.image.mimeType || "image/png" } });
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") {
      return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (req.method === "POST" && url.pathname === "/api/generate") return handleGenerate(req);
    if (req.method === "GET" && url.pathname.startsWith("/img/")) return handleServe(decodeURIComponent(url.pathname.slice(5)));
    return new Response("Not found", { status: 404 });
  },
};
