/**
 * Strip GEDCOM surname slashes from names for display.
 * e.g. "John /Gonsalves/" → "John Gonsalves"
 */
export function stripSlashesFromName(s: string | null | undefined): string {
  if (s == null || s === "") return "";
  return s.replace(/\//g, "").replace(/\s+/g, " ").trim();
}

/** Minimal shape for Prisma name-form includes (primary or ordered list). */
export type NameFormForDisplay = {
  isPrimary?: boolean | null;
  sortOrder?: number | null;
  givenNames?: Array<{ givenName?: { givenName?: string | null } | null } | null> | null;
  surnames?: Array<{ surname?: { surname?: string | null } | null } | null> | null;
};

/**
 * Build a display name from normalized name forms so all given names appear in order.
 * Falls back to stripped fullName when forms are missing or empty.
 */
export function formatDisplayNameFromNameForms(
  nameForms: NameFormForDisplay[] | null | undefined,
  fallbackFullName: string | null | undefined,
): string {
  const forms = (nameForms ?? []).filter(Boolean);
  if (forms.length === 0) {
    return stripSlashesFromName(fallbackFullName) || "";
  }
  const primary =
    forms.find((f) => f.isPrimary) ??
    [...forms].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];
  if (!primary) {
    return stripSlashesFromName(fallbackFullName) || "";
  }
  const givens = (primary.givenNames ?? [])
    .map((g) => g?.givenName?.givenName)
    .filter((s): s is string => typeof s === "string" && s.trim() !== "");
  const rawSurs = (primary.surnames ?? [])
    .map((s) => s?.surname?.surname)
    .filter((s): s is string => typeof s === "string" && s.trim() !== "");
  const givenPart = givens.join(" ");
  const surPart = rawSurs.map((s) => stripSlashesFromName(s)).filter(Boolean).join(" ");
  const composed = [givenPart, surPart].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  return stripSlashesFromName(fallbackFullName) || "";
}

/** Two-letter initials from a display name (first + last token heuristic). */
export function initialsFromPersonLabel(label: string): string {
  const n = label.trim();
  if (!n || n === "—") return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "?";
    const b = parts[parts.length - 1][0] ?? "?";
    return (a + b).toUpperCase();
  }
  const one = parts[0] ?? "";
  if (one.length >= 2) return one.slice(0, 2).toUpperCase();
  if (one.length === 1) return (one + one).toUpperCase();
  return "??";
}
