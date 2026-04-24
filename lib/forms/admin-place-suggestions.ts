import type { GedcomPlaceFormSlice } from "@/lib/forms/individual-editor-form";

/** Row shape returned by GET `/api/admin/places` (subset used for form fill). */
export type AdminPlaceSuggestionRow = {
  id: string;
  original: string;
  name: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  latitude: unknown;
  longitude: unknown;
};

function decimalToPlaceInputString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v !== null && "toString" in v) {
    return String((v as { toString: () => string }).toString()).trim();
  }
  return "";
}

/** Map an API place row into the place slice used by `GedcomPlaceInput`. */
export function adminPlaceSuggestionRowToFormSlice(row: AdminPlaceSuggestionRow): GedcomPlaceFormSlice {
  return {
    placeName: row.name?.trim() ?? "",
    placeCounty: row.county?.trim() ?? "",
    placeState: row.state?.trim() ?? "",
    placeCountry: row.country?.trim() ?? "",
    placeOriginal: row.original?.trim() ?? "",
    placeLat: decimalToPlaceInputString(row.latitude),
    placeLng: decimalToPlaceInputString(row.longitude),
  };
}

/**
 * Build a single search string from current place fields (whitespace-joined, de-duplicated tokens).
 * Used as `q` for GET `/api/admin/places`.
 */
export function buildPlaceSuggestionSearchText(slice: GedcomPlaceFormSlice): string {
  const parts = [
    slice.placeName,
    slice.placeCounty,
    slice.placeState,
    slice.placeCountry,
    slice.placeOriginal,
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/** Short label for a place form slice (e.g. media editor pills). */
export function formatGedcomPlaceFormSliceLabel(slice: GedcomPlaceFormSlice): string {
  return formatPlaceSuggestionLabel({
    id: "",
    original: slice.placeOriginal,
    name: slice.placeName || null,
    county: slice.placeCounty || null,
    state: slice.placeState || null,
    country: slice.placeCountry || null,
    latitude: slice.placeLat || null,
    longitude: slice.placeLng || null,
  });
}

/** One-line label for a suggestion button (structured fields, then original). */
export function formatPlaceSuggestionLabel(row: AdminPlaceSuggestionRow): string {
  const structured = [row.name, row.county, row.state, row.country]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(", ");
  const orig = row.original?.trim() ?? "";
  if (structured && orig && orig !== structured) return `${structured} — ${orig}`;
  return structured || orig || row.id;
}
