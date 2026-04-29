import { stripSlashesFromName } from "@/lib/gedcom/display-name";

type FamilyUnionNameSource = {
  id: string;
  xref?: string | null;
  husband?: { fullName?: string | null } | null;
  wife?: { fullName?: string | null } | null;
};

function strippedPartnerLabel(fullName: string | null | undefined): string {
  return stripSlashesFromName(fullName ?? "").trim();
}

/**
 * Primary line for family pickers: both parents with a neutral separator, no HUSB/WIFE ordering
 * (names sorted case-insensitively when both present). Falls back to xref / id.
 */
export function familyUnionPrimaryLine(f: FamilyUnionNameSource): string {
  const h = strippedPartnerLabel(f.husband?.fullName ?? null);
  const w = strippedPartnerLabel(f.wife?.fullName ?? null);
  const parts = [h, w].filter((p) => p.length > 0);
  if (parts.length === 0) return (f.xref?.trim() || f.id).trim();
  if (parts.length === 1) return parts[0]!;
  const [n0, n1] = parts;
  const ordered = n0!.toLowerCase() <= n1!.toLowerCase() ? [n0!, n1!] : [n1!, n0!];
  return `${ordered[0]} * ${ordered[1]}`;
}

/** Mono line: xref and optional marriage year when present on list items. */
export function familyUnionMetaLine(f: {
  xref?: string | null;
  marriageYear?: string | number | null;
  childrenCount?: number | null;
}): string | null {
  const bits: string[] = [];
  const xr = f.xref?.trim();
  if (xr) bits.push(xr);
  const y =
    typeof f.marriageYear === "number"
      ? String(f.marriageYear)
      : typeof f.marriageYear === "string"
        ? f.marriageYear.trim()
        : "";
  if (y) bits.push(y);
  if (f.childrenCount != null) bits.push(`${f.childrenCount} ch.`);
  return bits.length ? bits.join(" · ") : null;
}
