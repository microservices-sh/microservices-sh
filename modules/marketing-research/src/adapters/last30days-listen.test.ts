import { describe, expect, it } from "vitest";
import { createLast30daysListenPort, parseLast30daysOutput } from "./last30days-listen";
import { runResearch, createMemoryMarketingStore, type Synthesizer } from "../index";

// Trimmed capture of a real `/last30days --emit=compact` EVIDENCE block.
const FIXTURE = `
<!-- EVIDENCE FOR SYNTHESIS -->

## Ranked Evidence Clusters

### 3. Agentic coding is boring AF (score 30, 1 item, sources: Reddit)
1. [reddit] Agentic coding is boring AF
   - 2026-06-04 | r/BetterOffline | score:30
   - URL: https://www.reddit.com/r/BetterOffline/comments/1tx4fqi/agentic_coding_is_boring_af/
   - Evidence: My company has a KPI that by the end of the year, 90% of code is AI generated.

### 6. Please Do Not Vibe Fuck Up This Software (score 0, 1 item, sources: GitHub)
1. [github] Please Do Not Vibe Fuck Up This Software
   - 2026-05-30 | RsyncProject/rsync | [2,932react, 347cmt] | score:0
   - URL: https://github.com/RsyncProject/rsync/issues/929
   - Evidence: Looks like it's time to vibe-fork in Rust.

## Source Coverage

- GitHub: 18 items
- Hacker News: 0 items
- Reddit: 5 items

<!-- END EVIDENCE FOR SYNTHESIS -->
`;

describe("parseLast30daysOutput", () => {
  it("extracts grounded signals (source, url, title, excerpt, engagement)", () => {
    const { signals } = parseLast30daysOutput(FIXTURE);
    expect(signals).toHaveLength(2);
    expect(signals[0]).toEqual({
      source: "reddit",
      sourceUrl: "https://www.reddit.com/r/BetterOffline/comments/1tx4fqi/agentic_coding_is_boring_af/",
      title: "Agentic coding is boring AF",
      excerpt: "My company has a KPI that by the end of the year, 90% of code is AI generated.",
      engagement: 30
    });
    expect(signals[1].source).toBe("github");
    expect(signals[1].sourceUrl).toBe("https://github.com/RsyncProject/rsync/issues/929");
    expect(signals[1].engagement).toBe(0);
  });

  it("reports honest coverage (searched vs returned, with a zero note)", () => {
    const { coverage } = parseLast30daysOutput(FIXTURE);
    expect(coverage.searched).toEqual(["GitHub", "Hacker News", "Reddit"]);
    expect(coverage.returned).toEqual(["GitHub", "Reddit"]);
    expect(coverage.note).toBe("Hacker News returned 0");
  });

  it("drops items with no URL (can't ground a claim)", () => {
    const noUrl = `## Ranked Evidence Clusters
1. [reddit] A thread with no url
   - score:5
## Source Coverage
- Reddit: 1 items`;
    expect(parseLast30daysOutput(noUrl).signals).toHaveLength(0);
  });
});

describe("createLast30daysListenPort", () => {
  it("feeds parsed signals straight into runResearch (end-to-end, fake runner)", async () => {
    const listen = createLast30daysListenPort({ run: async () => FIXTURE });
    const synthesizer: Synthesizer = {
      async synthesize({ signals }) {
        return { summary: "ok", implications: ["x"], citedSourceUrls: [signals[0].sourceUrl] };
      }
    };
    const res = await runResearch(
      { topic: "agentic coding" },
      { store: createMemoryMarketingStore(), listen, synthesizer, now: () => 0, actor: { id: "u1", scopes: ["marketing.run"] } }
    );
    expect(res.status).toBe(201);
    if (res.ok) {
      expect((res.data as any).brief.citations[0].sourceUrl).toContain("BetterOffline");
      expect((res.data as any).brief.coverage.note).toBe("Hacker News returned 0");
    }
  });
});
