import type { PrismaClient } from "@ligneous/prisma";
import { deleteGedcomFamilyWithCleanup } from "@/lib/admin/admin-family-delete";
import { newBatchId } from "@/lib/admin/changelog";

export type EmptyFamilySkipReason = {
  familyId: string;
  xref: string;
  reason: string;
};

export type EmptyFamiliesCleanupResult = {
  deletedCount: number;
  deletedXrefs: string[];
  skipped: EmptyFamilySkipReason[];
};

/**
 * Deletes families that have no husband, no wife, and no children in the DB — the same shape
 * the GEDCOM validator reports as {@code EMPTY_FAMILY}. Skips rows that still have spouse or
 * family-partner junctions so we never leave dangling edges.
 */
export async function deleteEmptyFamiliesForFile(
  prisma: PrismaClient,
  fileUuid: string,
  userId: string,
): Promise<EmptyFamiliesCleanupResult> {
  const candidates = await prisma.gedcomFamily.findMany({
    where: {
      fileUuid,
      husbandId: null,
      wifeId: null,
      childrenCount: 0,
      familyChildren: { none: {} },
    },
    select: {
      id: true,
      xref: true,
      marriageDateId: true,
      marriagePlaceId: true,
      divorceDateId: true,
      divorcePlaceId: true,
    },
    orderBy: { xref: "asc" },
  });

  if (candidates.length === 0) {
    return { deletedCount: 0, deletedXrefs: [], skipped: [] };
  }

  const ids = candidates.map((c) => c.id);
  const [spouseFamilies, partnerFamilies] = await Promise.all([
    prisma.gedcomSpouse.findMany({
      where: { fileUuid, familyId: { in: ids } },
      select: { familyId: true },
      distinct: ["familyId"],
    }),
    prisma.gedcomFamilyPartner.findMany({
      where: { fileUuid, familyId: { in: ids } },
      select: { familyId: true },
      distinct: ["familyId"],
    }),
  ]);

  const spouseSet = new Set(spouseFamilies.map((r) => r.familyId));
  const partnerSet = new Set(partnerFamilies.map((r) => r.familyId));

  const skipped: EmptyFamilySkipReason[] = [];
  const toDelete = candidates.filter((c) => {
    if (spouseSet.has(c.id)) {
      skipped.push({
        familyId: c.id,
        xref: c.xref,
        reason: "Still has gedcom_spouses rows for this family (not safe to auto-delete).",
      });
      return false;
    }
    if (partnerSet.has(c.id)) {
      skipped.push({
        familyId: c.id,
        xref: c.xref,
        reason: "Still has gedcom_family_partner rows (not safe to auto-delete).",
      });
      return false;
    }
    return true;
  });

  if (toDelete.length === 0) {
    return { deletedCount: 0, deletedXrefs: [], skipped };
  }

  const batchId = newBatchId();
  const deletedXrefs: string[] = [];

  await prisma.$transaction(async (tx) => {
    const ctx = { tx, fileUuid, userId, batchId };
    for (const fam of toDelete) {
      await deleteGedcomFamilyWithCleanup(ctx, fam);
      deletedXrefs.push(fam.xref);
    }
  });

  return { deletedCount: toDelete.length, deletedXrefs, skipped };
}
