// Server wiring for the marketing-research module (demo data path).
//
// Production wires a hosted SocialListenPort (a signal service) + an ai-gateway
// Synthesizer + the D1 store. Here we use demo signals + a deterministic
// synthesizer + the in-memory store so the template renders a real CITED brief
// without a live engine or an LLM key — cite-or-refuse and coverage are real.
import {
  createMemoryMarketingStore,
  type Signal,
  type SocialListenPort,
  type Synthesizer
} from "@microservices-sh/marketing-research";

// Real findings from community listening — so the demo is on-brand, not lorem.
const DEMO_SIGNALS: Signal[] = [
  {
    source: "reddit",
    sourceUrl: "https://www.reddit.com/r/CloudFlare/comments/multitenant",
    title: "Porting multi-tenant RBAC by hand onto Workers + D1",
    excerpt: "rebuilding tenant isolation + auth on every project",
    engagement: 40
  },
  {
    source: "reddit",
    sourceUrl: "https://www.reddit.com/r/Supabase/comments/protect",
    title: "A simple way to protect your project from day 0 (don't expose data)",
    excerpt: "disable auto-expose, force RLS — people get this wrong",
    engagement: 31
  },
  {
    source: "reddit",
    sourceUrl: "https://www.reddit.com/r/SaaS/comments/webhooks",
    title: "How are you handling failed webhooks and async tasks?",
    excerpt: "background workers and webhooks are basically half the app",
    engagement: 22
  }
];

// Persisted across requests for the life of the server (demo only).
export const marketingStore = createMemoryMarketingStore();

export function demoListen(): SocialListenPort {
  return {
    async listen({ topic }) {
      // Topic is echoed so the brief is clearly about what was asked; the demo
      // returns the same grounded set regardless. Coverage is honestly partial.
      const signals = DEMO_SIGNALS.map((s) => ({ ...s }));
      return {
        signals,
        coverage: { searched: ["reddit", "hackernews"], returned: signals.length ? ["reddit"] : [], note: "hackernews returned 0 (demo)" }
      };
    }
  };
}

// Deterministic stand-in for the ai-gateway synthesizer (no LLM key in the demo).
export function demoSynth(): Synthesizer {
  return {
    async synthesize({ signals }) {
      const top = signals.slice(0, 6);
      return {
        summary: `Builders are hand-rolling the 30% (auth, multi-tenant, webhooks); cited ${top.length} signals.`,
        implications: top.map((s) => `[${s.source}] ${s.title}`),
        citedSourceUrls: top.map((s) => s.sourceUrl)
      };
    }
  };
}
