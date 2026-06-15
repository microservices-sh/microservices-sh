import type { Connections } from "../manifest";

export interface GraphModule {
  id: string;
  grantedScopes?: string[];
  connections: Connections;
}

export interface RpcEdge {
  from: string;
  target: string;
  targetModule: string;
  method: string;
  scope: string | null;
}

export interface EventEdge {
  event: string;
  from: string;
  to: string;
}

export interface HookLink {
  target: string;
  targetModule: string;
  point: string;
  registrant: string;
  handler: string;
  order: number;
}

export interface ConnectionGraph {
  rpcEdges: RpcEdge[];
  eventEdges: EventEdge[];
  hookChains: Record<string, HookLink[]>;
  exposesByModule: Record<string, Record<string, Connections["rpc"]["exposes"][number]>>;
  hookPointsByModule: Record<string, Connections["hookPoints"]>;
  scopesByModule: Record<string, string[]>;
  emittersByEvent: Record<string, string[]>;
  moduleIds: Set<string>;
}

export function buildGraph(modules: GraphModule[]): ConnectionGraph;
