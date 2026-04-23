import { createHash } from "node:crypto";

/** Matches gedcom-go `hashPlace`: MD5 of lowercased trimmed original string. */
export function hashGedcomPlaceOriginal(original: string): string {
  const normalized = original.trim().toLowerCase();
  return createHash("md5").update(normalized).digest("hex");
}

/** Matches gedcom-go `hashDate`: MD5 of type|y|m|d|ey|em|ed with missing parts as 0. */
export function hashGedcomDateParts(input: {
  dateType: string;
  year: number | null | undefined;
  month: number | null | undefined;
  day: number | null | undefined;
  endYear: number | null | undefined;
  endMonth: number | null | undefined;
  endDay: number | null | undefined;
}): string {
  const n = (v: number | null | undefined) => String(v ?? 0);
  const s = [
    input.dateType,
    n(input.year),
    n(input.month),
    n(input.day),
    n(input.endYear),
    n(input.endMonth),
    n(input.endDay),
  ].join("|");
  return createHash("md5").update(s).digest("hex");
}

/** Build a display-style original line from structured place fields (for hash when user did not type original). */
export function composePlaceOriginal(parts: {
  name?: string;
  county?: string;
  state?: string;
  country?: string;
}): string {
  return [parts.name, parts.county, parts.state, parts.country]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(", ");
}
