/**
 * Human-readable labels for GEDCOM date rows (original + structured parts).
 * ABOUT (GEDCOM ABT) uses a leading tilde instead of "ABOUT: …".
 */

export type GedcomDateDisplayInput = {
  original?: string | null;
  dateType?: string | null;
  year?: number | null;
  month?: number | null;
  day?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  endDay?: number | null;
};

export function isAboutDateType(dateType: string | null | undefined): boolean {
  const u = String(dateType ?? "").trim().toUpperCase();
  return u === "ABOUT" || u === "ABT";
}

function ymdParts(
  year?: number | null,
  month?: number | null,
  day?: number | null,
): string {
  return [year, month, day]
    .map((x) => (x == null ? "" : String(x)))
    .filter(Boolean)
    .join("-");
}

/**
 * One-line display for a stored GEDCOM date.
 * Prefers `original` when set; otherwise builds from parts + date type.
 */
export function formatGedcomDateDisplayLabel(row: GedcomDateDisplayInput): string {
  const orig = row.original?.trim();
  if (orig) return orig;

  const ymd = ymdParts(row.year, row.month, row.day);
  const tail = ymdParts(row.endYear, row.endMonth, row.endDay);
  const base = ymd || "(no structured date)";
  const dt = String(row.dateType ?? "EXACT").trim().toUpperCase();

  if (tail) {
    if (isAboutDateType(dt)) {
      return `~${base} … ${tail}`;
    }
    return `${dt}: ${base} … ${tail}`;
  }
  if (isAboutDateType(dt)) {
    return `~${base}`;
  }
  return `${dt}: ${base}`;
}
