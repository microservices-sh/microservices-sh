export function shipmentId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function isoNow(now?: () => number): string {
  return new Date(now ? now() : Date.now()).toISOString();
}

export function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
