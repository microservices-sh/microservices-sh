export function mergeMetadata(
  current: Record<string, unknown>,
  patch?: Record<string, unknown>
): Record<string, unknown> {
  if (!patch) return current;
  return { ...current, ...patch };
}
