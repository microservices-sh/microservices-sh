import { generateEventRouter } from "./event-codegen.js";
import { generateHookMap } from "./hook-codegen.js";
import { generateRpcEntrypoint, generateRpcClient } from "./rpc-codegen.js";

// Single entry the CLI/build calls to materialize the honeycomb wiring (Plan 25 §7).
// Consumes a compose() result (so it has no dependency on the composer itself) plus
// the parsed module set (needed for per-module rpc codegen). `write(path, contents)`
// is injected so this is testable without disk.
//
//   { result: ComposeResult, modules: [{id, connections}], write }
//
// Returns the list of written paths. Throws (writing nothing) if compose failed.
export function emitArtifacts({ result, modules, write }) {
  if (!result.ok) {
    const codes = (result.issues ?? []).map((i) => i.code).join(", ");
    throw new Error(`Cannot emit artifacts: compose failed (${codes || "unknown"})`);
  }

  const paths = [];
  const emit = (path, contents) => {
    write(path, contents);
    paths.push(path);
  };

  emit("wiring.json", JSON.stringify(result.wiring, null, 2));
  emit("generated/event-routes.ts", generateEventRouter(result.wiring));
  emit("generated/hook-chains.ts", generateHookMap(result.wiring));

  for (const module of modules) {
    const entrypoint = generateRpcEntrypoint(module);
    if (entrypoint) emit(`generated/${module.id}.entrypoint.ts`, entrypoint);
    const client = generateRpcClient(module);
    if (client) emit(`generated/${module.id}.client.ts`, client);
  }

  return paths;
}
