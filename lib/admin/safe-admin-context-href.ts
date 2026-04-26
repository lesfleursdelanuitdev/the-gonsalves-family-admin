/**
 * Allows only relative `/admin/*` in-app return links.
 * Rejects empty values and absolute/protocol-based URLs.
 */
export function safeAdminContextHref(href: string | undefined): string | undefined {
  if (!href?.trim()) return undefined;
  const t = href.trim();
  if (!t.startsWith("/admin/")) return undefined;
  if (t.includes("://")) return undefined;
  return t;
}
