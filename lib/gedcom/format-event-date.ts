import { formatGedcomDateDisplayLabel } from "@/lib/gedcom/format-gedcom-date-display";

function numField(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Format a GEDCOM event date for display.
 * Prefers the original date string, falls back to year/month/day parts and date type.
 */
export function formatEventDate(e: {
  dateOriginal?: string | null;
  dateType?: string | null;
  year?: number | null;
  month?: number | null;
  day?: number | null;
}): string {
  const o = typeof e.dateOriginal === "string" ? e.dateOriginal.trim() : "";
  const hasYmd = e.year != null || e.month != null || e.day != null;
  if (!o && !hasYmd) return "—";
  return formatGedcomDateDisplayLabel({
    original: o || null,
    dateType: e.dateType ?? "EXACT",
    year: e.year,
    month: e.month,
    day: e.day,
  });
}

/**
 * Format a date record (with `original` field) for display.
 * Used for event detail pages where the date is a nested object.
 */
export function formatDateRecord(d: unknown): string {
  if (!d || typeof d !== "object") return "";
  const r = d as Record<string, unknown>;
  const orig = typeof r.original === "string" ? r.original.trim() : "";
  const year = numField(r.year);
  const month = numField(r.month);
  const day = numField(r.day);
  const endYear = numField(r.endYear);
  const endMonth = numField(r.endMonth);
  const endDay = numField(r.endDay);
  const hasParts =
    year != null ||
    month != null ||
    day != null ||
    endYear != null ||
    endMonth != null ||
    endDay != null;
  if (!orig && !hasParts) return "";
  const dateType = r.dateType != null && String(r.dateType).trim() ? String(r.dateType) : "EXACT";
  return formatGedcomDateDisplayLabel({
    original: orig || null,
    dateType,
    year,
    month,
    day,
    endYear,
    endMonth,
    endDay,
  });
}
