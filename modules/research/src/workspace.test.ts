import { describe, expect, it } from "vitest";
import { WORKSPACE_MAX_TOPK, loadWorkspaceConfig } from "./workspace";

// Injected reader backed by an in-memory file map; missing files throw (like fs).
function reader(files: Record<string, string>) {
  return async (path: string) => {
    const name = path.split("/").pop() as string;
    if (!(name in files)) throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    return files[name];
  };
}

describe("loadWorkspaceConfig", () => {
  it("assembles a sectioned preamble from soul/policy/glossary + name/tone", async () => {
    const read = reader({
      "soul.md": "You advise ACME on operations.",
      "policy.md": "Never give legal advice; route to counsel.",
      "glossary.md": "NRR = net revenue retention.",
      "config.json": JSON.stringify({ name: "ACME Advisor", tone: "terse" })
    });
    const ws = await loadWorkspaceConfig("/data/workspace", { read });
    expect(ws.systemPreamble).toContain("## Identity");
    expect(ws.systemPreamble).toContain("ACME Advisor");
    expect(ws.systemPreamble).toContain("terse");
    expect(ws.systemPreamble).toContain("You advise ACME on operations.");
    expect(ws.systemPreamble).toContain("## Operating policy");
    expect(ws.systemPreamble).toContain("route to counsel");
    expect(ws.systemPreamble).toContain("## Glossary");
    expect(ws.systemPreamble).toContain("net revenue retention");
  });

  it("omits sections for missing files and returns empty preamble when nothing is present", async () => {
    const only = await loadWorkspaceConfig("/x", { read: reader({ "policy.md": "Be careful." }) });
    expect(only.systemPreamble).toContain("## Operating policy");
    expect(only.systemPreamble).not.toContain("## Identity");
    expect(only.systemPreamble).not.toContain("## Glossary");

    const empty = await loadWorkspaceConfig("/x", { read: reader({}) });
    expect(empty.systemPreamble).toBe("");
    expect(empty.settings).toEqual({});
  });

  it("parses config settings, caps topK, and IGNORES operator-locked fields (model/owner)", async () => {
    const read = reader({
      "config.json": JSON.stringify({
        name: "Bot",
        topK: 999,
        citationStyle: "inline",
        opsTools: ["ops.invoice.read"],
        model: "anthropic/claude-3.5-haiku", // must be ignored
        owner: "someone-else" // must be ignored
      })
    });
    const ws = await loadWorkspaceConfig("/x", { read });
    expect(ws.settings.name).toBe("Bot");
    expect(ws.settings.topK).toBe(WORKSPACE_MAX_TOPK); // clamped from 999
    expect(ws.settings.citationStyle).toBe("inline");
    expect(ws.settings.opsTools).toEqual(["ops.invoice.read"]);
    expect((ws.settings as any).model).toBeUndefined();
    expect((ws.settings as any).owner).toBeUndefined();
  });

  it("tolerates invalid/malformed config.json without throwing", async () => {
    const ws = await loadWorkspaceConfig("/x", { read: reader({ "config.json": "{not json" }) });
    expect(ws.settings).toEqual({});
    expect(ws.systemPreamble).toBe("");
  });

  it("floors topK at 1 and drops non-numeric topK", async () => {
    const low = await loadWorkspaceConfig("/x", { read: reader({ "config.json": JSON.stringify({ topK: 0 }) }) });
    expect(low.settings.topK).toBe(1);
    const bad = await loadWorkspaceConfig("/x", { read: reader({ "config.json": JSON.stringify({ topK: "lots" }) }) });
    expect(bad.settings.topK).toBeUndefined();
  });
});
