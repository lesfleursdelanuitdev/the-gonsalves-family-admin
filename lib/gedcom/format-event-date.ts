/**
 * Format a GEDCOM event date for display.
 * Prefers the original date string, falls back to year/month/day parts.
 */
export function formatEventDate(
  e: { dateOriginal?: string | null; year?: number | null; month?: number | null; day?: number | null },
): string {
  if (e.dateOriginal) return e.dateOriginal;
  if (e.year != null) {
    const parts = [e.year, e.month, e.day].filter((x) => x != null);
    return parts.join("-");
  }
  return "—";
}

/**
 * Format a date record (with `original` field) for display.
 * Used for event detail pages where the date is a nested object.
 */
export function formatDateRecord(d: unknown): string {
  if (!d || typeof d !== "object") return "";
  const r = d as Record<string, unknown>;
  const orig = r.original as string | null | undefined;
  if (orig?.trim()) return orig.trim();
  const y = r.year as number | null | undefined;
  if (y != null) {
    const parts = [y, r.month, r.day].filter((x) => x != null);
    return parts.join("-");
  }
  return "";
}
