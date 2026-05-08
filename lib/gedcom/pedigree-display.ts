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

export type ParentChildEdgeForPedigree = {
  familyId: string | null;
  parentId: string;
  relationshipType: string | null;
  pedigree: string | null;
};

function sortEdgesParentSlot(
  rows: ParentChildEdgeForPedigree[],
  husbandId: string | null | undefined,
  wifeId: string | null | undefined,
): ParentChildEdgeForPedigree[] {
  const h = husbandId ?? "";
  const w = wifeId ?? "";
  const rank = (parentId: string) => (parentId === h ? 0 : parentId === w ? 1 : 2);
  return [...rows].sort((a, b) => rank(a.parentId) - rank(b.parentId));
}

/** Parent–child rows for this person in a given FAM (prefers `familyId`; falls back when it is null). */
export function parentChildEdgesForFamilyAsChild(
  edges: ParentChildEdgeForPedigree[],
  familyId: string,
  husbandId: string | null | undefined,
  wifeId: string | null | undefined,
): { relationshipType: string | null; pedigree: string | null }[] {
  const h = husbandId ?? null;
  const w = wifeId ?? null;
  const parentInUnion = (parentId: string) => parentId === h || parentId === w;
  const inFam = sortEdgesParentSlot(
    edges.filter((e) => e.familyId === familyId && parentInUnion(e.parentId)),
    husbandId,
    wifeId,
  );
  if (inFam.length > 0) {
    return inFam.map(({ relationshipType, pedigree }) => ({ relationshipType, pedigree }));
  }
  return sortEdgesParentSlot(
    edges.filter((e) => !e.familyId && parentInUnion(e.parentId)),
    husbandId,
    wifeId,
  ).map(({ relationshipType, pedigree }) => ({ relationshipType, pedigree }));
}

export function summarizePedigreeForChildInFamily(
  edges: ParentChildEdgeForPedigree[],
  familyId: string,
  husbandId: string | null | undefined,
  wifeId: string | null | undefined,
): string {
  return mergePedigreesForChild(parentChildEdgesForFamilyAsChild(edges, familyId, husbandId, wifeId));
}

export type ParentChildRelForChildIndicator = {
  childId: string;
  parentId: string;
  familyId: string | null;
  relationshipType: string | null;
  pedigree: string | null;
};

const BIRTH_LIKE_RELATIONSHIP = new Set(["biological", "birth"]);

/**
 * Parent–child rows that belong to this FAM for list/badge purposes.
 * Requires `parentId` to be this union’s husband or wife so stray `family_id` values
 * cannot label a child’s other-family links as belonging here.
 */
export function filterParentChildRelsForFamilyList(
  rels: ParentChildRelForChildIndicator[],
  familyId: string,
  husbandId: string | null | undefined,
  wifeId: string | null | undefined,
): ParentChildRelForChildIndicator[] {
  const h = husbandId ?? null;
  const w = wifeId ?? null;
  return rels.filter((r) => {
    const pid = r.parentId?.trim() ?? "";
    if (!pid || (pid !== h && pid !== w)) return false;
    if (r.familyId === familyId) return true;
    if (r.familyId == null) return true;
    return false;
  });
}

/** True when any parent–child link for this child is not plain birth (incl. custom `pedigree` text). */
export function childShowsNonBirthIndicator(
  rows: { relationshipType: string | null; pedigree: string | null }[],
): boolean {
  for (const row of rows) {
    if ((row.pedigree ?? "").trim()) return true;
    const rt = (row.relationshipType || "biological").toLowerCase().trim();
    if (!BIRTH_LIKE_RELATIONSHIP.has(rt)) return true;
  }
  return false;
}

/**
 * Map child id → show non-birth icon for **this family only**.
 * `parentChildRels` on a family can include other families’ links for the same child (unique is per parent–child, not per FAM);
 * we filter by `familyId` / parents in this union before aggregating.
 */
export function buildChildNonBirthIndicatorMap(
  rels: ParentChildRelForChildIndicator[],
  familyId: string,
  husbandId: string | null | undefined,
  wifeId: string | null | undefined,
): Map<string, boolean> {
  const scoped = filterParentChildRelsForFamilyList(rels, familyId, husbandId, wifeId);
  const byChild = new Map<string, { relationshipType: string | null; pedigree: string | null }[]>();
  for (const r of scoped) {
    const cid = (r.childId ?? "").trim();
    if (!cid) continue;
    const list = byChild.get(cid) ?? [];
    list.push({ relationshipType: r.relationshipType, pedigree: r.pedigree });
    byChild.set(cid, list);
  }
  const m = new Map<string, boolean>();
  for (const [childId, rows] of byChild) {
    m.set(childId, childShowsNonBirthIndicator(rows));
  }
  return m;
}
