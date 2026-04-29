import type { GedcomDateFormSlice } from "@/lib/forms/individual-editor-form";
import { formatGedcomDateDisplayLabel } from "@/lib/gedcom/format-gedcom-date-display";

/** Row shape returned by GET `/api/admin/dates` (fields used to fill the date form). */
export type AdminDateSuggestionRow = {
  id: string;
  original: string | null;
  dateType: string;
  calendar: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
};

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Map form slice to API-shaped row for display helpers. */
export function gedcomDateFormSliceToSuggestionRow(slice: GedcomDateFormSlice): AdminDateSuggestionRow {
  return {
    id: "",
    original: slice.dateOriginal.trim() ? slice.dateOriginal.trim() : null,
    dateType: slice.dateSpecifier || "EXACT",
    calendar: "GREGORIAN",
    year: numOrNull(slice.y),
    month: numOrNull(slice.m),
    day: numOrNull(slice.d),
    endYear: numOrNull(slice.ey),
    endMonth: numOrNull(slice.em),
    endDay: numOrNull(slice.ed),
  };
}

export function formatGedcomDateFormSliceLabel(slice: GedcomDateFormSlice): string {
  return formatDateSuggestionLabel(gedcomDateFormSliceToSuggestionRow(slice));
}

function intToStr(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }
  return "";
}

/** Map an API date row into the slice used by `GedcomDateInput`. */
export function adminDateSuggestionRowToFormSlice(row: AdminDateSuggestionRow): GedcomDateFormSlice {
  return {
    dateSpecifier: row.dateType != null && row.dateType !== "" ? String(row.dateType) : "EXACT",
    dateOriginal: row.original != null ? String(row.original).trim() : "",
    y: intToStr(row.year),
    m: intToStr(row.month),
    d: intToStr(row.day),
    ey: intToStr(row.endYear),
    em: intToStr(row.endMonth),
    ed: intToStr(row.endDay),
  };
}

/**
 * Build `q` for GET `/api/admin/dates` from current date fields (joined, max 200 chars).
 */
export function buildDateSuggestionSearchText(slice: GedcomDateFormSlice): string {
  const parts = [
    slice.dateOriginal,
    slice.y,
    slice.m,
    slice.d,
    slice.ey,
    slice.em,
    slice.ed,
    slice.dateSpecifier !== "EXACT" ? slice.dateSpecifier : "",
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/** One-line label for a suggestion row. */
export function formatDateSuggestionLabel(row: AdminDateSuggestionRow): string {
  return formatGedcomDateDisplayLabel({
    original: row.original,
    dateType: row.dateType,
    year: row.year,
    month: row.month,
    day: row.day,
    endYear: row.endYear,
    endMonth: row.endMonth,
    endDay: row.endDay,
  });
}
