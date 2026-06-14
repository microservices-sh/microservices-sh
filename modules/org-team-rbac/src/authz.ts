// Permission matching with wildcard support: "*" grants all; "billing.*" grants
// any "billing.<x>"; otherwise an exact match is required.
export function permissionMatches(granted: string, required: string): boolean {
  if (granted === "*" || granted === required) return true;
  if (granted.endsWith(".*")) {
    const prefix = granted.slice(0, -1); // keep trailing dot
    return required.startsWith(prefix);
  }
  return false;
}

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.some((p) => permissionMatches(p, required));
}
