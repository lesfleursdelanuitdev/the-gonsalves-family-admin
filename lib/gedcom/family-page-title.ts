import { stripSlashesFromName } from "./display-name";

/** Minimal partner fields for headings (matches API `husband` / `wife` on family detail). */
export type FamilyPageTitlePartner = {
  fullName: string | null;
  xref: string | null;
} | null;

/** View heading: "Family of X and Y", or one partner, or plain "Family". */
export function familyOfPageTitle(
  husband: FamilyPageTitlePartner,
  wife: FamilyPageTitlePartner,
): string {
  const x = husband ? stripSlashesFromName(husband.fullName) || husband.xref || null : null;
  const y = wife ? stripSlashesFromName(wife.fullName) || wife.xref || null : null;
  if (x && y) return `Family of ${x} and ${y}`;
  if (x) return `Family of ${x}`;
  if (y) return `Family of ${y}`;
  return "Family";
}

/** Edit screen `<h1>` — same wording as before, centralized. */
export function editFamilyPageTitle(
  husband: FamilyPageTitlePartner,
  wife: FamilyPageTitlePartner,
): string {
  const t = familyOfPageTitle(husband, wife);
  if (t === "Family") return "Edit family";
  return `Edit ${t}`;
}
