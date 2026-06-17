export const siteTitle = import.meta.env.SITE_TITLE || "Migrated Blog";
export const siteDescription =
  import.meta.env.SITE_DESCRIPTION || "A WordPress blog migrated to EmDash on Cloudflare.";

export function siteUrl(path = "/") {
  const base = import.meta.env.SITE_URL || import.meta.env.EMDASH_SITE_URL || "http://localhost:4321";
  return new URL(path, base).toString();
}
