import { describe, it, expect } from "vitest";
import { createKieAiProvider } from "./kie-ai";
import { createGeminiProvider } from "./gemini";
import { createGptImageProvider } from "./gpt-image";
import { ImageProviderError } from "../errors";

function jsonRes(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

const b64 = (s: string) => btoa(s);

describe("kie-ai provider", () => {
  it("creates a task, polls to success, and downloads the image", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("/createTask")) return jsonRes({ data: { taskId: "t1" } });
      if (u.includes("/recordInfo")) {
        return jsonRes({ data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://cdn.test/x.png"] }) } });
      }
      if (u === "https://cdn.test/x.png") return new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "content-type": "image/png" } });
      throw new Error("unexpected url " + u);
    }) as unknown as typeof fetch;

    const provider = createKieAiProvider({ apiKey: "k", fetchImpl, sleep: async () => {}, pollIntervalMs: 0 });
    const res = await provider.generate({ prompt: "a fox", aspectRatio: "1:1" });

    expect(res.mimeType).toBe("image/png");
    expect(Array.from(res.imageBytes)).toEqual([1, 2, 3, 4]);
    expect(calls.some((u) => u.includes("/createTask"))).toBe(true);
    expect(calls.some((u) => u.includes("/recordInfo"))).toBe(true);
  });

  it("throws a retryable ImageProviderError when createTask returns 500", async () => {
    const fetchImpl = (async () => jsonRes({ error: "boom" }, 500)) as unknown as typeof fetch;
    const provider = createKieAiProvider({ apiKey: "k", fetchImpl, sleep: async () => {} });
    await expect(provider.generate({ prompt: "x", aspectRatio: "1:1" })).rejects.toMatchObject({ status: 500 });
    await expect(provider.generate({ prompt: "x", aspectRatio: "1:1" })).rejects.toBeInstanceOf(ImageProviderError);
  });

  it("throws when the task fails", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/createTask")) return jsonRes({ data: { taskId: "t1" } });
      if (u.includes("/recordInfo")) return jsonRes({ data: { state: "fail", failMsg: "nope" } });
      throw new Error("unexpected");
    }) as unknown as typeof fetch;
    const provider = createKieAiProvider({ apiKey: "k", fetchImpl, sleep: async () => {} });
    await expect(provider.generate({ prompt: "x", aspectRatio: "1:1" })).rejects.toBeInstanceOf(ImageProviderError);
  });
});

describe("gemini provider", () => {
  it("parses inline image data from a generateContent response", async () => {
    const fetchImpl = (async () =>
      jsonRes({
        candidates: [{ content: { parts: [{ inlineData: { data: b64("PNGBYTES"), mimeType: "image/png" } }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 },
      })) as unknown as typeof fetch;

    const provider = createGeminiProvider({ endpoint: "https://gw.test/gemini", fetchImpl });
    const res = await provider.generate({ prompt: "a fox", aspectRatio: "16:9" });

    expect(res.mimeType).toBe("image/png");
    expect(new TextDecoder().decode(res.imageBytes)).toBe("PNGBYTES");
    expect(res.usage.inputTokens).toBe(12);
    expect(res.usage.outputTokens).toBe(34);
  });

  it("throws when the response carries no image", async () => {
    const fetchImpl = (async () => jsonRes({ candidates: [{ content: { parts: [{ text: "no image" }] } }] })) as unknown as typeof fetch;
    const provider = createGeminiProvider({ endpoint: "https://gw.test/gemini", fetchImpl });
    await expect(provider.generate({ prompt: "x", aspectRatio: "1:1" })).rejects.toBeInstanceOf(ImageProviderError);
  });
});

describe("gpt-image provider", () => {
  it("parses b64_json from the images/generations response", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return jsonRes({ data: [{ b64_json: b64("GPTBYTES") }] });
    }) as unknown as typeof fetch;

    const provider = createGptImageProvider({ apiKey: "sk", fetchImpl });
    const res = await provider.generate({ prompt: "a fox", aspectRatio: "1:1" });

    expect(res.mimeType).toBe("image/png");
    expect(new TextDecoder().decode(res.imageBytes)).toBe("GPTBYTES");
    expect(calls[0]).toContain("/images/generations");
  });

  it("throws a retryable error on 429", async () => {
    const fetchImpl = (async () => jsonRes({ error: "rate" }, 429)) as unknown as typeof fetch;
    const provider = createGptImageProvider({ apiKey: "sk", fetchImpl });
    await expect(provider.generate({ prompt: "x", aspectRatio: "1:1" })).rejects.toMatchObject({ status: 429 });
  });
});
