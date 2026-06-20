import { type GraphStore } from "./graph";
import { loadGraphifyDir } from "./adapters/graphify-out-loader";

// Build use-case for the Hermes Fly runtime: run graphify over the client's
// source files, then ingest the result into the per-client graph store. Two
// triggers:
//   - "manual": full extract (operator-initiated, e.g. first build or rebuild).
//   - "cron":   incremental extract (`--update`, re-reads only changed files).
// graphify never runs at query time; this is the only writer of the graph.

type Reader = (path: string) => Promise<string>;
type GraphifyRunner = (argv: string[]) => Promise<{ ok: true } | { ok: false; stderr?: string }>;

export type BuildMode = "manual" | "cron";

export async function runGraphBuild(opts: {
  sourcesDir: string;
  outDir: string;
  mode: BuildMode;
  store: GraphStore;
  ownerId: string;
  runGraphify: GraphifyRunner;
  read?: Reader;
}) {
  const argv = ["extract", opts.sourcesDir];
  if (opts.mode === "cron") argv.push("--update"); // incremental re-extraction

  const build = await opts.runGraphify(argv);
  if (!build.ok) {
    return { ok: false as const, status: 502, error: { code: "GRAPHIFY_BUILD_FAILED", message: `graphify extract failed: ${build.stderr ?? "unknown error"}` } };
  }

  return loadGraphifyDir(opts.outDir, { store: opts.store, ownerId: opts.ownerId }, opts.read);
}
