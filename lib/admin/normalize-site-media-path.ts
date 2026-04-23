/**
 * Pure string helpers for site-relative media paths (safe for client bundles).
 */

/**
 * Collapse accidental leading `//` on site paths stored in `file_ref`.
 * Values like `//uploads/...` are protocol-relative in browsers and trigger
 * `UriError` in strict URI tooling (e.g. VS Code/Cursor) when parsed as `file:` paths.
 */
export function normalizeSiteMediaPath(ref: string): string {
  const t = ref.trim();
  if (!t) return t;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return t.replace(/^\/+/, "/");
  return t;
}
