import type { ConnectionGraph, GraphModule } from "./graph";

export interface Issue {
  rule: string;
  severity: "error" | "warn";
  code: string;
  message: string;
  module: string;
  detail: unknown;
}

export type Rule = (graph: ConnectionGraph, modules: GraphModule[]) => Issue[];

export const allRules: Rule[];
export function runRules(graph: ConnectionGraph, modules: GraphModule[]): Issue[];
