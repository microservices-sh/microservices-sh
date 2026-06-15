import type { ImageProvider } from "../ports";
import type { ProviderEditInput, ProviderGenerateInput, ProviderImageResult } from "../types";
import { ImageProviderError } from "../errors";

export interface KieAiOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxPolls?: number;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
}

const DEFAULT_BASE = "https://api.kie.ai/api/v1/jobs";

function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

// kie.ai nano-banana adapter. Generation is async: create a task, poll until it
// succeeds, then download the produced image.
export function createKieAiProvider(opts: KieAiOptions): ImageProvider {
  const base = opts.baseUrl ?? DEFAULT_BASE;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pollIntervalMs = opts.pollIntervalMs ?? 2000;
  const maxPolls = opts.maxPolls ?? 45;

  async function run(input: Record<string, unknown>): Promise<ProviderImageResult> {
    const createRes = await doFetch(`${base}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nano-banana-2", input }),
    });
    if (!createRes.ok) {
      throw new ImageProviderError("kie.ai createTask failed", createRes.status, await createRes.text());
    }
    const createData = (await createRes.json()) as { data?: { taskId?: string } };
    const taskId = createData.data?.taskId;
    if (!taskId) throw new ImageProviderError("kie.ai returned no taskId", 502);

    let imageUrl: string | undefined;
    for (let i = 0; i < maxPolls; i++) {
      await sleep(pollIntervalMs);
      const pollRes = await doFetch(`${base}/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${opts.apiKey}` },
      });
      if (!pollRes.ok) continue;
      const pollData = (await pollRes.json()) as { data?: { state?: string; resultJson?: string; failMsg?: string } };
      const state = pollData.data?.state;
      if (state === "success") {
        const parsed = JSON.parse(pollData.data?.resultJson ?? "{}") as { resultUrls?: string[] };
        imageUrl = parsed.resultUrls?.[0];
        break;
      }
      if (state === "fail") {
        throw new ImageProviderError(`kie.ai task failed: ${pollData.data?.failMsg ?? "unknown"}`, 502);
      }
    }
    if (!imageUrl) throw new ImageProviderError("kie.ai generation timed out", 504);

    const imgRes = await doFetch(imageUrl);
    if (!imgRes.ok) throw new ImageProviderError("Failed to download kie.ai image", 502);
    const imageBytes = new Uint8Array(await imgRes.arrayBuffer());
    const mimeType = imgRes.headers.get("content-type") || "image/png";

    // kie.ai does not report token usage; approximate to keep billing consistent.
    return { imageBytes, mimeType, usage: { inputTokens: 250, outputTokens: 6000 } };
  }

  return {
    id: "kie-ai",
    async generate(input: ProviderGenerateInput) {
      return run({
        prompt: input.negativePrompt ? `${input.prompt}\n\nAvoid: ${input.negativePrompt}` : input.prompt,
        image_input: [],
        aspect_ratio: input.aspectRatio,
        resolution: "2K",
        output_format: "png",
      });
    },
    async edit(input: ProviderEditInput) {
      return run({
        prompt: input.prompt,
        image_input: [toDataUrl(input.imageBytes, input.mimeType)],
        resolution: "2K",
        output_format: "png",
      });
    },
  };
}
