export interface HookLink {
  registrant: string;
  handler: string;
  order: number;
  kind: "filter" | "guard" | "observer" | null;
  point?: string;
  targetModule?: string;
}
export interface HookWiring {
  hooks: Record<string, HookLink[]>;
}
export function hookChainMap(
  wiring: HookWiring
): Record<string, Array<{ module: string; handler: string; order: number; kind: HookLink["kind"] }>>;
export function generateHookMap(wiring: HookWiring): string;
