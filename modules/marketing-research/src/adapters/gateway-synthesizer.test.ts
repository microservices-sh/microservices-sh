import { describe, expect, it } from "vitest";
import { createGatewaySynthesizer, type CompleteFn } from "./gateway-synthesizer";
import { runResearch, createMemoryMarketingStore, type Signal, type SocialListenPort } from "../index";

const SIGNALS: Signal[] = [
  { source: "reddit", sourceUrl: "https://reddit.com/r/CloudFlare/1", title: "Hand-rolling multi-tenant RBAC", excerpt: "porting RBAC by hand", engagement: 40 },
  { source: "reddit", sourceUrl: "https://reddit.com/r/Supabase/2", title: "Protect from day 0", excerpt: "don't expose data", engagement: 31 }
];

const ok = (text: string): CompleteFn => async () => ({ ok: true, data: { text } });

describe("createGatewaySynthesizer", () => {
  it("parses a strict-JSON completion into summary/implications/citedSourceUrls", async () => {
    const synth = createGatewaySynthesizer(
      ok(JSON.stringify({ summary: "Builders rebuild the 30%.", implications: ["Lead with fails-closed"], citedSourceUrls: [SIGNALS[0].sourceUrl] }))
    );
    const out = await synth.synthesize({ topic: "cloudflare", signals: SIGNALS });
    expect(out.summary).toBe("Builders rebuild the 30%.");
    expect(out.implications).toEqual(["Lead with fails-closed"]);
    expect(out.citedSourceUrls).toEqual([SIGNALS[0].sourceUrl]);
  });

  it("extracts JSON even when the model wraps it in prose", async () => {
    const synth = createGatewaySynthesizer(ok(`Sure! {"summary":"x","implications":[],"citedSourceUrls":[]} done`));
    const out = await synth.synthesize({ topic: "x", signals: SIGNALS });
    expect(out.summary).toBe("x");
  });

  it("returns empty (→ cite-or-refuse upstream) on non-JSON output", async () => {
    const synth = createGatewaySynthesizer(ok("I cannot help with that."));
    const out = await synth.synthesize({ topic: "x", signals: SIGNALS });
    expect(out).toEqual({ summary: "", implications: [], citedSourceUrls: [] });
  });

  it("throws when the gateway call fails", async () => {
    const synth = createGatewaySynthesizer(async () => ({ ok: false, status: 429, error: { code: "AI_BUDGET_EXCEEDED" } }));
    await expect(synth.synthesize({ topic: "x", signals: SIGNALS })).rejects.toThrow(/AI_BUDGET_EXCEEDED/);
  });

  it("wires through runResearch end-to-end → a cited brief", async () => {
    const listen: SocialListenPort = { async listen() { return { signals: SIGNALS, coverage: { searched: ["reddit"], returned: ["reddit"] } }; } };
    const synthesizer = createGatewaySynthesizer(
      ok(JSON.stringify({ summary: "ok", implications: ["a"], citedSourceUrls: SIGNALS.map((s) => s.sourceUrl) }))
    );
    const res = await runResearch(
      { topic: "cloudflare" },
      { store: createMemoryMarketingStore(), listen, synthesizer, now: () => 0, actor: { id: "u1", scopes: ["marketing.run"] } }
    );
    expect(res.status).toBe(201);
    if (res.ok) expect((res.data as any).brief.citations).toHaveLength(2);
  });
});
