/**
 * Merges family children from gedcom_family_children_v2 with children found only
 * via gedcom_parent_child_v2 (some imports or legacy data omit the FAM–CHIL junction).
 */
import { Prisma } from "@ligneous/prisma";
import type { PrismaClient } from "@ligneous/prisma";

type ChildMini = {
  id: string;
  xref: string | null;
  fullName: string | null;
  sex: string | null;
  birthYear: number | null;
};

export type MergedFamilyChildRow = {
  id: string;
  fileUuid: string;
  familyId: string;
  childId: string;
  childXref: string | null;
  birthOrder: number | null;
  createdAt: Date;
  child: ChildMini;
};

function sortRows(a: MergedFamilyChildRow, b: MergedFamilyChildRow) {
  const ao = a.birthOrder ?? 10_000;
  const bo = b.birthOrder ?? 10_000;
  if (ao !== bo) return ao - bo;
  const an = (a.child.fullName || a.child.xref || "").toLowerCase();
  const bn = (b.child.fullName || b.child.xref || "").toLowerCase();
  return an.localeCompare(bn);
}

/**
 * Expands `familyChildren` with any child linked via parent_child for this family
 * or (when both spouses exist) linked to both spouses with `family_id` null.
 */
export async function mergeFamilyChildrenForApi(
  prisma: PrismaClient,
  fileUuid: string,
  family: {
    id: string;
    husbandId: string | null;
    wifeId: string | null;
    familyChildren: Array<{
      id: string;
      fileUuid: string;
      familyId: string;
      childId: string;
      childXref: string | null;
      birthOrder: number | null;
      createdAt: Date;
      child: ChildMini;
    }>;
    parentChildRels: Array<{ childId: string }>;
  },
): Promise<MergedFamilyChildRow[]> {
  const rows: MergedFamilyChildRow[] = family.familyChildren.map((row) => ({
    id: row.id,
    fileUuid: row.fileUuid,
    familyId: row.familyId,
    childId: row.childId,
    childXref: row.childXref,
    birthOrder: row.birthOrder,
    createdAt: row.createdAt,
    child: row.child,
  }));

  const have = new Set(rows.map((r) => r.childId));
  const want = new Set<string>();

  for (const r of family.parentChildRels) {
    if (r.childId) want.add(r.childId);
  }

  const explicitPc = await prisma.gedcomParentChild.findMany({
    where: { fileUuid, familyId: family.id },
    select: { childId: true },
  });
  for (const r of explicitPc) {
    want.add(r.childId);
  }

  if (family.husbandId && family.wifeId) {
    const bothRows = await prisma.$queryRaw<{ child_id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT pc.child_id AS child_id
        FROM gedcom_parent_child_v2 pc
        WHERE pc.file_uuid = ${fileUuid}::uuid
          AND pc.family_id IS NULL
          AND pc.parent_id = ${family.husbandId}::uuid
          AND EXISTS (
            SELECT 1 FROM gedcom_parent_child_v2 pc2
            WHERE pc2.file_uuid = pc.file_uuid
              AND pc2.child_id = pc.child_id
              AND pc2.parent_id = ${family.wifeId}::uuid
              AND pc2.family_id IS NULL
          )
      `,
    );
    for (const r of bothRows) {
      want.add(r.child_id);
    }
  }

  const need = [...want].filter((id) => !have.has(id));
  if (need.length === 0) {
    return rows.sort(sortRows);
  }

  const extras = await prisma.gedcomIndividual.findMany({
    where: { id: { in: need }, fileUuid },
    select: { id: true, xref: true, fullName: true, sex: true, birthYear: true },
  });

  for (const ind of extras) {
    rows.push({
      id: `parent-child-${ind.id}`,
      fileUuid,
      familyId: family.id,
      childId: ind.id,
      childXref: ind.xref,
      birthOrder: null,
      createdAt: new Date(0),
      child: ind,
    });
  }

  return rows.sort(sortRows);
}
