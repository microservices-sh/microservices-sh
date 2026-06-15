export interface EventWiring {
  events: Array<{ event: string; from: string; to: string }>;
}
export function eventRoutes(wiring: EventWiring): Record<string, string[]>;
export function generateEventRouter(wiring: EventWiring): string;
