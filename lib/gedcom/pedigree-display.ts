/** Human-readable pedigree / parent–child relationship for admin UI. */

export function formatPedigreeRelationship(
  relationshipType: string | null | undefined,
  pedigree: string | null | undefined,
): string {
  const ped = (pedigree ?? "").trim();
  if (ped) return ped;
  const r = (relationshipType || "biological").toLowerCase();
  const map: Record<string, string> = {
    biological: "Birth",
    birth: "Birth",
    adopted: "Adopted",
    foster: "Foster",
    step: "Step",
    sealing: "Sealing",
  };
  return map[r] ?? (relationshipType || "—");
}

export function mergePedigreesForChild(
  rows: { relationshipType: string | null; pedigree: string | null }[],
): string {
  const labels = new Set<string>();
  for (const row of rows) {
    labels.add(formatPedigreeRelationship(row.relationshipType, row.pedigree));
  }
  const arr = [...labels].filter((x) => x !== "—");
  return arr.length ? arr.join(" · ") : "—";
}
