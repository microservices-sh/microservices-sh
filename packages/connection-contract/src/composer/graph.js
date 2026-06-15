// Pure resolver: turn a set of modules into the connection graph. No validation
// here (Task 9 / rules.js does that) — just resolve edges and build indexes.
//
// A module is { id, grantedScopes: string[], connections: <parsed connectionsSchema> }.
// Returns { rpcEdges, eventEdges, hookChains, exposesByModule, hookPointsByModule,
//           scopesByModule, emittersByEvent, moduleIds }.

function splitTarget(target) {
  const dot = target.indexOf(".");
  return { module: target.slice(0, dot), name: target.slice(dot + 1) };
}

export function buildGraph(modules) {
  const moduleIds = new Set(modules.map((m) => m.id));

  const exposesByModule = {};
  const hookPointsByModule = {};
  const scopesByModule = {};
  const emittersByEvent = {};

  for (const m of modules) {
    exposesByModule[m.id] = {};
    for (const e of m.connections.rpc.exposes) exposesByModule[m.id][e.method] = e;
    hookPointsByModule[m.id] = { ...m.connections.hookPoints };
    scopesByModule[m.id] = [...(m.grantedScopes ?? [])];
    for (const ev of m.connections.events.emits) {
      (emittersByEvent[ev] ??= []).push(m.id);
    }
  }

  const rpcEdges = [];
  for (const m of modules) {
    for (const call of m.connections.rpc.calls) {
      const { module: targetModule, name: method } = splitTarget(call.target);
      rpcEdges.push({
        from: m.id,
        target: call.target,
        targetModule,
        method,
        scope: call.scope ?? null,
        input: call.input ?? null,
      });
    }
  }

  const eventEdges = [];
  for (const m of modules) {
    for (const ev of m.connections.events.consumes) {
      for (const emitter of emittersByEvent[ev] ?? []) {
        eventEdges.push({ event: ev, from: emitter, to: m.id });
      }
    }
  }

  const hookChains = {};
  for (const m of modules) {
    for (const h of m.connections.provides.hooks) {
      const { module: targetModule, name: point } = splitTarget(h.target);
      (hookChains[h.target] ??= []).push({
        target: h.target,
        targetModule,
        point,
        registrant: m.id,
        handler: h.handler,
        order: h.order,
      });
    }
  }
  for (const key of Object.keys(hookChains)) {
    hookChains[key].sort((a, b) => a.order - b.order);
  }

  return {
    rpcEdges,
    eventEdges,
    hookChains,
    exposesByModule,
    hookPointsByModule,
    scopesByModule,
    emittersByEvent,
    moduleIds,
  };
}
