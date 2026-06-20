import { type GraphStore, loadGraphifyOutput } from "../graph";

// Reads a graphify output directory and ingests it into a GraphStore.
//
// Source of truth = `graph.json` only — graphify's documented node_link_data
// export. It already embeds per-node `community` + `community_name` and per-edge
// `relation` + `weight`, so we never need the internal `.graphify_*` artifacts,
// which drift across graphify versions. `.graphify_analysis.json` is read
// best-effort solely for optional community `cohesion`; its absence is fine.

type Reader = (path: string) => Promise<string>;

type GraphJsonNode = {
  id: string;
  label: string;
  file_type?: string;
  source_file: string;
  source_location: string | null;
  community?: number;
  community_name?: string;
};
type GraphJsonLink = { source: string; target: string; relation: string; weight?: number };

type LoadError = { ok: false; status: number; error: { code: string; message: string } };
type LoadOk = Awaited<ReturnType<typeof loadGraphifyOutput>>;

// Default reader uses node:fs at runtime without a static type dependency, so
// this module typechecks in the Workers-typed env (like the rest of the module,
// which injects its I/O). The string-built specifier defeats static resolution.
const defaultReader: Reader = async (path) => {
  const fs = (await import("node:fs/promises" as string)) as { readFile(p: string, enc: string): Promise<string> };
  return fs.readFile(path, "utf8");
};

const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, "")}/${name}`;

export async function loadGraphifyDir(
  dir: string,
  deps: { store: GraphStore; ownerId: string },
  read: Reader = defaultReader
): Promise<LoadOk | LoadError> {
  const graphPath = joinPath(dir, "graph.json");

  let rawGraph: string;
  try {
    rawGraph = await read(graphPath);
  } catch (cause) {
    return { ok: false, status: 404, error: { code: "GRAPH_JSON_MISSING", message: `Cannot read ${graphPath}: ${(cause as Error).message}` } };
  }

  let graph: { nodes?: unknown; links?: unknown };
  try {
    graph = JSON.parse(rawGraph);
  } catch (cause) {
    return { ok: false, status: 422, error: { code: "GRAPH_JSON_INVALID", message: `graph.json is not valid JSON: ${(cause as Error).message}` } };
  }
  if (!Array.isArray(graph.nodes)) {
    return { ok: false, status: 422, error: { code: "GRAPH_JSON_INVALID", message: "graph.json missing required `nodes` array" } };
  }
  if (!Array.isArray(graph.links)) {
    return { ok: false, status: 422, error: { code: "GRAPH_JSON_INVALID", message: "graph.json missing required `links` array" } };
  }

  const gnodes = graph.nodes as GraphJsonNode[];
  const glinks = graph.links as GraphJsonLink[];

  // Group node ids by community, and capture each community's name.
  const communities: Record<string, string[]> = {};
  const labels: Record<string, string> = {};
  for (const node of gnodes) {
    if (node.community === undefined || node.community === null) continue;
    const cid = String(node.community);
    (communities[cid] ??= []).push(node.id);
    if (node.community_name && labels[cid] === undefined) labels[cid] = node.community_name;
  }

  // Optional enrichment: community cohesion from the internal analysis artifact.
  let cohesion: Record<string, number> | undefined;
  try {
    const rawAnalysis = await read(joinPath(dir, ".graphify_analysis.json"));
    const analysis = JSON.parse(rawAnalysis) as { cohesion?: Record<string, number> };
    if (analysis.cohesion && typeof analysis.cohesion === "object") cohesion = analysis.cohesion;
  } catch {
    // absent or unparseable — cohesion stays undefined (it is optional).
  }

  const input = {
    semantic: {
      nodes: gnodes.map((n) => ({
        id: n.id,
        label: n.label,
        file_type: n.file_type,
        source_file: n.source_file,
        source_location: n.source_location
      })),
      edges: glinks.map((l) => ({ source: l.source, target: l.target, relation: l.relation, weight: l.weight }))
    },
    analysis: { communities, cohesion },
    labels
  };

  return loadGraphifyOutput(input, deps);
}
