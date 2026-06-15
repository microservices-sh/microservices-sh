// The 7 composer validation rules (Plan 25 §7). Each rule is
// (graph, modules) => Issue[]. An Issue is
//   { rule, severity: "error"|"warn", code, message, module, detail }.
// `compose()` fails the build if any error-severity issue is returned.

const issue = (rule, severity, code, message, module, detail) => ({
  rule, severity, code, message, module, detail: detail ?? null,
});

// 1 — requires / rpc.calls target a module not in the selected set.
function missingModule(graph, modules) {
  const out = [];
  for (const m of modules) {
    for (const req of m.connections.requires) {
      if (!graph.moduleIds.has(req)) {
        out.push(issue("missingModule", "error", "MISSING_MODULE",
          `Module "${m.id}" requires "${req}", which is not in the selected set.`, m.id, { req }));
      }
    }
  }
  for (const e of graph.rpcEdges) {
    if (!graph.moduleIds.has(e.targetModule)) {
      out.push(issue("missingModule", "error", "MISSING_MODULE",
        `Module "${e.from}" calls "${e.target}", but module "${e.targetModule}" is not in the selected set.`, e.from, { target: e.target }));
    }
  }
  return out;
}

// 2 — consumes an event no selected module emits (warn if the source is optional).
function danglingConsumer(graph, modules) {
  const out = [];
  for (const m of modules) {
    for (const ev of m.connections.events.consumes) {
      const emitters = graph.emittersByEvent[ev] ?? [];
      if (emitters.length === 0) {
        const sourceModule = ev.split(".")[0];
        const optional = m.connections.optional.includes(sourceModule);
        out.push(issue("danglingConsumer", optional ? "warn" : "error", "DANGLING_CONSUMER",
          `Module "${m.id}" consumes "${ev}" but no selected module emits it.`, m.id, { event: ev }));
      }
    }
  }
  return out;
}

// 3 — caller/registrant lacks the scope required by the rpc call or hook point.
function scopeGap(graph, modules) {
  const out = [];
  for (const e of graph.rpcEdges) {
    if (e.scope && !(graph.scopesByModule[e.from] ?? []).includes(e.scope)) {
      out.push(issue("scopeGap", "error", "SCOPE_GAP",
        `Module "${e.from}" calls "${e.target}" requiring scope "${e.scope}" it has not been granted.`, e.from, { scope: e.scope }));
    }
  }
  for (const links of Object.values(graph.hookChains)) {
    for (const link of links) {
      const point = graph.hookPointsByModule[link.targetModule]?.[link.point];
      if (!point) continue; // missing target handled by rule 4
      if (point.scope && !(graph.scopesByModule[link.registrant] ?? []).includes(point.scope)) {
        out.push(issue("scopeGap", "error", "SCOPE_GAP",
          `Module "${link.registrant}" registers into "${link.target}" requiring scope "${point.scope}" it has not been granted.`, link.registrant, { scope: point.scope }));
      }
    }
  }
  return out;
}

// 4 — provides.hooks targets a hook point that does not exist.
function hookTargetMissing(graph) {
  const out = [];
  for (const links of Object.values(graph.hookChains)) {
    for (const link of links) {
      const exists = graph.moduleIds.has(link.targetModule) &&
        Boolean(graph.hookPointsByModule[link.targetModule]?.[link.point]);
      if (!exists) {
        out.push(issue("hookTargetMissing", "error", "HOOK_TARGET_MISSING",
          `Module "${link.registrant}" registers into hook point "${link.target}", which does not exist.`, link.registrant, { target: link.target }));
      }
    }
  }
  return out;
}

// 5 — two handlers on the same hook point share an order.
function hookOrderCollision(graph) {
  const out = [];
  for (const [point, links] of Object.entries(graph.hookChains)) {
    const seen = new Map();
    for (const link of links) {
      if (seen.has(link.order)) {
        out.push(issue("hookOrderCollision", "error", "HOOK_ORDER_COLLISION",
          `Hook point "${point}" has two handlers at order ${link.order} ("${seen.get(link.order)}" and "${link.registrant}").`, link.registrant, { point, order: link.order }));
      } else {
        seen.set(link.order, link.registrant);
      }
    }
  }
  return out;
}

// 6 — a declared call input does not match the exposed method's input schema.
function schemaMismatch(graph) {
  const out = [];
  for (const e of graph.rpcEdges) {
    if (!e.input) continue;
    const expose = graph.exposesByModule[e.targetModule]?.[e.method];
    if (expose && expose.input && expose.input !== e.input) {
      out.push(issue("schemaMismatch", "error", "SCHEMA_MISMATCH",
        `Module "${e.from}" calls "${e.target}" with input "${e.input}" but the exposed method declares "${expose.input}".`, e.from, { call: e.input, exposed: expose.input }));
    }
  }
  return out;
}

// 7 — a cycle exists in the requires/rpc dependency graph (events/hooks may cycle).
function dependencyCycle(graph, modules) {
  const adj = {};
  for (const m of modules) {
    adj[m.id] = new Set(m.connections.requires.filter((r) => graph.moduleIds.has(r)));
  }
  for (const e of graph.rpcEdges) {
    if (graph.moduleIds.has(e.targetModule)) (adj[e.from] ??= new Set()).add(e.targetModule);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const id of Object.keys(adj)) color[id] = WHITE;
  const out = [];
  let found = false;

  const visit = (node) => {
    if (found) return;
    color[node] = GRAY;
    for (const next of adj[node] ?? []) {
      if (color[next] === GRAY) {
        out.push(issue("dependencyCycle", "error", "DEPENDENCY_CYCLE",
          `Dependency cycle detected involving "${node}" -> "${next}".`, node, { edge: [node, next] }));
        found = true;
        return;
      }
      if (color[next] === WHITE) visit(next);
    }
    color[node] = BLACK;
  };

  for (const id of Object.keys(adj)) if (color[id] === WHITE) visit(id);
  return out;
}

export const allRules = [
  missingModule,
  danglingConsumer,
  scopeGap,
  hookTargetMissing,
  hookOrderCollision,
  schemaMismatch,
  dependencyCycle,
];

export function runRules(graph, modules) {
  return allRules.flatMap((rule) => rule(graph, modules));
}
