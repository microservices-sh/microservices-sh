import type { ResearchRuntime } from "./runtime";

// Bridge: graphify output files -> runtime.loadGraph. Pure (the file reader is
// injected) so it's tsc-clean and testable; the entry (graph-build.ts) passes
// node:fs readFileSync. graphify writes these three JSON files; we parse exactly
// the shape loadGraphifyOutput expects.
export type ReadFile = (path: string) => string;

const FILES = {
  semantic: ".graphify_semantic.json",
  analysis: ".graphify_analysis.json",
  labels: ".graphify_labels.json"
} as const;

export function loadGraphFromDir(opts: { runtime: ResearchRuntime; dir: string; ownerId: string; readFile: ReadFile }) {
  const read = (name: string) => JSON.parse(opts.readFile(`${opts.dir}/${name}`));
  const graphify = {
    semantic: read(FILES.semantic),
    analysis: read(FILES.analysis),
    labels: read(FILES.labels)
  };
  return opts.runtime.loadGraph(graphify, opts.ownerId);
}
