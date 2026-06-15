export interface EmitInput {
  result: { ok: true; wiring: unknown } | { ok: false; issues?: Array<{ code: string }> };
  modules: Array<{ id: string; connections?: unknown; rpc?: unknown }>;
  write: (path: string, contents: string) => void;
}
export function emitArtifacts(input: EmitInput): string[];
