import type { z } from "zod";

export type HookKind = "filter" | "guard" | "observer";

export interface Connections {
  requires: string[];
  optional: string[];
  rpc: {
    exposes: Array<{ method: string; scope?: string | null; public: boolean; input?: string; output?: string }>;
    calls: Array<{ target: string; scope?: string | null; input?: string }>;
  };
  events: { emits: string[]; consumes: string[] };
  hookPoints: Record<string, { kind: HookKind; input?: string; output?: string; scope?: string | null }>;
  provides: { hooks: Array<{ target: string; handler: string; order: number }> };
}

export const connectionsSchema: z.ZodType<Connections>;
