import { connectionsSchema } from "../manifest.js";
import { buildGraph } from "./graph.js";
import { runRules } from "./rules.js";

// Build-time composer. Input: modules with RAW connections blocks
//   [{ id, grantedScopes?: string[], connections: <raw> }]
// Parses + validates each, resolves the graph, runs all 7 rules. If any
// error-severity issue is found, returns { ok:false, issues }. Otherwise returns
// { ok:true, wiring, warnings } where `wiring` is a stable, JSON-serializable
// description of the resolved honeycomb. See Plan 25 §7.

function stableWiring(graph) {
  const rpc = [...graph.rpcEdges].sort(
    (a, b) => a.from.localeCompare(b.from) || a.target.localeCompare(b.target)
  );
  const events = [...graph.eventEdges].sort(
    (a, b) =>
      a.event.localeCompare(b.event) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
  );
  const hooks = {};
  for (const key of Object.keys(graph.hookChains).sort()) {
    hooks[key] = [...graph.hookChains[key]]
      .sort((a, b) => a.order - b.order)
      // attach the hook point's kind so downstream codegen needs only `wiring`.
      .map((link) => ({
        ...link,
        kind: graph.hookPointsByModule[link.targetModule]?.[link.point]?.kind ?? null,
      }));
  }
  return {
    modules: [...graph.moduleIds].sort(),
    rpc,
    events,
    hooks,
  };
}

export function compose(modules) {
  const parsed = modules.map((m) => ({
    id: m.id,
    grantedScopes: m.grantedScopes ?? [],
    connections: connectionsSchema.parse(m.connections ?? {}),
  }));

  const graph = buildGraph(parsed);
  const issues = runRules(graph, parsed);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");

  if (errors.length > 0) {
    return { ok: false, issues: errors, warnings };
  }
  return { ok: true, wiring: stableWiring(graph), warnings };
}
