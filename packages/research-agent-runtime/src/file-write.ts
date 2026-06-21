import { resolve, sep } from "node:path";

// Resolve an upload target to a SAFE absolute path under one of the two writable
// areas (the corpus and the workspace config). This is the security core of the
// upload endpoint: a write to an arbitrary path could overwrite server.mjs /
// graph-build.mjs or drop an authorized_keys file. We reject traversal, absolute
// paths, and NUL, then verify the resolved real path stays inside the area base
// (defense in depth). Pure + testable; the caller does mkdir + write.

export type UploadArea = "sources" | "workspace";

export type ResolveResult = { ok: true; path: string } | { ok: false; code: "BAD_AREA" | "BAD_PATH" };

export function resolveUploadPath(opts: {
  area: string;
  name: string;
  sourcesDir: string;
  workspaceDir: string;
}): ResolveResult {
  const base =
    opts.area === "sources" ? opts.sourcesDir : opts.area === "workspace" ? opts.workspaceDir : null;
  if (!base) return { ok: false, code: "BAD_AREA" };

  const name = opts.name;
  if (!name || name.includes("\0") || name.includes("..") || name.startsWith("/")) {
    return { ok: false, code: "BAD_PATH" };
  }

  const full = resolve(base, name);
  if (full !== base && !full.startsWith(base + sep)) return { ok: false, code: "BAD_PATH" };
  return { ok: true, path: full };
}
