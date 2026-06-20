import { describe, it, expect } from "vitest";
import { createBuildTrigger } from "../src/graph-build-trigger.js";

describe("createBuildTrigger", () => {
  it("starts idle", () => {
    const t = createBuildTrigger(() => {}, () => "T0");
    expect(t.status()).toEqual({ running: false, startedAt: null, finishedAt: null, ok: null, tail: "" });
  });

  it("start() marks running and stamps startedAt", () => {
    let times = ["T1"];
    const t = createBuildTrigger(() => {}, () => times.shift()!);
    expect(t.start()).toBe(true);
    expect(t.status()).toMatchObject({ running: true, startedAt: "T1", finishedAt: null, ok: null });
  });

  it("rejects a second start while a build is in flight", () => {
    let done: ((ok: boolean, tail: string) => void) | null = null;
    const t = createBuildTrigger((onDone) => { done = onDone; }, () => "T");
    expect(t.start()).toBe(true);
    expect(t.start()).toBe(false); // still running, not started again
    done!(true, "ok"); // finish the first build
    expect(t.start()).toBe(true); // now allowed again
  });

  it("records ok + tail + finishedAt when the build completes", () => {
    let done: ((ok: boolean, tail: string) => void) | null = null;
    const times = ["start", "finish"];
    const t = createBuildTrigger((onDone) => { done = onDone; }, () => times.shift()!);
    t.start();
    done!(true, "graph loaded: 42 nodes");
    expect(t.status()).toEqual({
      running: false,
      startedAt: "start",
      finishedAt: "finish",
      ok: true,
      tail: "graph loaded: 42 nodes"
    });
  });

  it("records failure (ok=false) and preserves the log tail", () => {
    let done: ((ok: boolean, tail: string) => void) | null = null;
    const t = createBuildTrigger((onDone) => { done = onDone; }, () => "T");
    t.start();
    done!(false, "graphify failed: boom");
    expect(t.status()).toMatchObject({ running: false, ok: false, tail: "graphify failed: boom" });
  });
});
