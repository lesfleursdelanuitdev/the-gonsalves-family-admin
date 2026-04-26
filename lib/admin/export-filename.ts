const SAFE_BASE = /^[a-zA-Z0-9._-]+$/;

/**
 * Single path segment for download filenames (no slashes or control chars).
 */
export function sanitizeExportBasename(raw: string | null | undefined, fallback: string): string {
  const t = (raw ?? "").trim().slice(0, 120);
  if (!t) return fallback;
  const collapsed = t.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]+/g, "");
  if (!collapsed || !SAFE_BASE.test(collapsed)) return fallback;
  return collapsed;
}
