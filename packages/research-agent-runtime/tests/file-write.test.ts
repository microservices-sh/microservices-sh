import { describe, expect, it } from "vitest";
import { resolveUploadPath } from "../src/file-write";

const bases = { sourcesDir: "/data/sources", workspaceDir: "/data/workspace" };

describe("resolveUploadPath (write-path confinement)", () => {
  it("resolves a file under the sources area", () => {
    expect(resolveUploadPath({ area: "sources", name: "refund-policy.md", ...bases })).toEqual({ ok: true, path: "/data/sources/refund-policy.md" });
  });

  it("resolves a file under the workspace area", () => {
    expect(resolveUploadPath({ area: "workspace", name: "soul.md", ...bases })).toEqual({ ok: true, path: "/data/workspace/soul.md" });
  });

  it("allows a nested subpath inside the area", () => {
    expect(resolveUploadPath({ area: "sources", name: "policies/refunds.md", ...bases })).toEqual({ ok: true, path: "/data/sources/policies/refunds.md" });
  });

  it("rejects an unknown area", () => {
    expect(resolveUploadPath({ area: "etc", name: "passwd", ...bases })).toMatchObject({ ok: false, code: "BAD_AREA" });
    expect(resolveUploadPath({ area: "", name: "x", ...bases })).toMatchObject({ ok: false, code: "BAD_AREA" });
  });

  it("rejects traversal, absolute paths, and NUL", () => {
    const nul = "x" + String.fromCharCode(0) + "y";
    for (const name of ["../server.mjs", "a/../../etc/passwd", "/etc/passwd", nul, "../../graph-build.mjs"]) {
      expect(resolveUploadPath({ area: "sources", name, ...bases })).toMatchObject({ ok: false, code: "BAD_PATH" });
    }
  });

  it("rejects an empty name", () => {
    expect(resolveUploadPath({ area: "sources", name: "", ...bases })).toMatchObject({ ok: false, code: "BAD_PATH" });
  });

  it("confines even when the resolved path would escape the base", () => {
    expect(resolveUploadPath({ area: "workspace", name: "../sources/../../root/.ssh/authorized_keys", ...bases })).toMatchObject({ ok: false, code: "BAD_PATH" });
  });

  it("allows ordinary filenames with spaces and dashes", () => {
    expect(resolveUploadPath({ area: "sources", name: "Q3 report.md", ...bases })).toEqual({ ok: true, path: "/data/sources/Q3 report.md" });
  });
});
