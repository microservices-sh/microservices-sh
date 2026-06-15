import type { Issue } from "./rules";
import type { EventEdge, HookLink, RpcEdge } from "./graph";
import type { Connections } from "../manifest";

export interface RawModule {
  id: string;
  grantedScopes?: string[];
  connections?: Partial<Connections> | Record<string, unknown>;
}

export interface Wiring {
  modules: string[];
  rpc: RpcEdge[];
  events: EventEdge[];
  hooks: Record<string, HookLink[]>;
}

export type ComposeResult =
  | { ok: true; wiring: Wiring; warnings: Issue[] }
  | { ok: false; issues: Issue[]; warnings: Issue[] };

export function compose(modules: RawModule[]): ComposeResult;
