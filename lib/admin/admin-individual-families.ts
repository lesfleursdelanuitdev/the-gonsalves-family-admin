import type { Prisma } from "@ligneous/prisma";
import type { ChangeCtx } from "@/lib/admin/changelog";

type Tx = Prisma.TransactionClient;

const ALLOWED_RELATIONSHIP = new Set([
  "biological",
  "birth",
  "adopted",
  "foster",
  "step",
  "sealing",
]);

export function normalizeChildRelationshipType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (ALLOWED_RELATIONSHIP.has(t)) return t === "birth" ? "biological" : t;
  return "biological";
}

/**
 * Keep the denormalized `husband_xref` / `wife_xref` columns on `gedcom_families_v2`
 * in sync with the current `husband_id` / `wife_id`. The tree viewer descendancy route
 * resolves family members via these xref columns, so they must stay up-to-date.
 */
export async function syncFamilySpouseXrefs(tx: Tx, familyId: string) {
  const fam = await tx.gedcomFamily.findUnique({
    where: { id: familyId },
    select: { husbandId: true, wifeId: true },
  });
  if (!fam) return;

  const [husb, wife] = await Promise.all([
    fam.husbandId
      ? tx.gedcomIndividual.findUnique({ where: { id: fam.husbandId }, select: { xref: true } })
      : null,
    fam.wifeId
      ? tx.gedcomIndividual.findUnique({ where: { id: fam.wifeId }, select: { xref: true } })
      : null,
  ]);

  await tx.gedcomFamily.update({
    where: { id: familyId },
    data: {
      husbandXref: husb?.xref ?? null,
      wifeXref: wife?.xref ?? null,
    },
  });
}

/**
 * When both partner slots are filled, each couple should map to at most one `gedcom_families_v2`
 * row per file (duplicate empty families break spouse-edge uniqueness and GEDCOM export).
 */
export async function findExistingCoupleFamilyId(
  tx: Tx,
  fileUuid: string,
  husbandId: string,
  wifeId: string,
  excludeFamilyId?: string,
): Promise<string | null> {
  const row = await tx.gedcomFamily.findFirst({
    where: {
      fileUuid,
      husbandId,
      wifeId,
      ...(excludeFamilyId ? { id: { not: excludeFamilyId } } : {}),
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function rebuildSpouseRowsForFamily(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  await tx.gedcomSpouse.deleteMany({ where: { familyId } });
  const fam = await tx.gedcomFamily.findUnique({
    where: { id: familyId },
    select: { husbandId: true, wifeId: true },
  });
  if (!fam?.husbandId || !fam?.wifeId) return;
  await tx.gedcomSpouse.createMany({
    data: [
      {
        fileUuid,
        familyId,
        individualId: fam.husbandId,
        spouseId: fam.wifeId,
      },
      {
        fileUuid,
        familyId,
        individualId: fam.wifeId,
        spouseId: fam.husbandId,
      },
    ],
  });
}

/**
 * GEDCOM storage uses husband/wife columns (admin UI: Partner 1 / Partner 2). Used when an individual must occupy
 * exactly one slot from sex alone (e.g. syncing spouse-family picks from the individual editor). Unknown/other (U/X)
 * cannot be resolved without the other partner — use `canonicalSpouseSlotsForPair` in `addParentToFamily` instead.
 */
export function spouseSlotFromSex(sex: string | null | undefined): "husband" | "wife" {
  const s = sex != null ? String(sex).toUpperCase() : "";
  if (s === "M") return "husband";
  if (s === "F") return "wife";
  throw new Error(
    "Sex must be Male (M) or Female (F) to link as a spouse; husband/wife slots follow that assignment.",
  );
}

type NormalizedSpouseSex = "M" | "F" | "U" | "X" | "";

function normalizeSpouseSexForSlot(sex: string | null | undefined): NormalizedSpouseSex {
  if (sex == null || sex === "") return "";
  const u = String(sex).trim().toUpperCase();
  if (u === "M" || u === "F" || u === "U" || u === "X") return u;
  return "";
}

function isUnknownOrOtherSpouseSex(s: NormalizedSpouseSex): boolean {
  return s === "U" || s === "X" || s === "";
}

/**
 * Canonical Partner 1 (HUSB) / Partner 2 (WIFE) placement for two parents.
 * Matches rules in `family-partner-slots.ts`.
 */
export function canonicalSpouseSlotsForPair(
  a: { id: string; sex: string | null | undefined },
  b: { id: string; sex: string | null | undefined },
): { husbandId: string; wifeId: string } {
  const sa = normalizeSpouseSexForSlot(a.sex);
  const sb = normalizeSpouseSexForSlot(b.sex);

  if (sa === "M" && sb === "F") return { husbandId: a.id, wifeId: b.id };
  if (sb === "M" && sa === "F") return { husbandId: b.id, wifeId: a.id };

  if (isUnknownOrOtherSpouseSex(sa) && sb === "F") return { husbandId: a.id, wifeId: b.id };
  if (isUnknownOrOtherSpouseSex(sb) && sa === "F") return { husbandId: b.id, wifeId: a.id };

  if (isUnknownOrOtherSpouseSex(sa) && sb === "M") return { husbandId: b.id, wifeId: a.id };
  if (isUnknownOrOtherSpouseSex(sb) && sa === "M") return { husbandId: a.id, wifeId: b.id };

  const [first, second] = a.id.localeCompare(b.id) <= 0 ? [a, b] : [b, a];
  return { husbandId: first.id, wifeId: second.id };
}

/** First parent on a family with no partners yet: F→WIFE; M / U / X / missing → HUSB. */
export function singleSpouseSlotForFirstParent(sex: string | null | undefined): "husband" | "wife" {
  const s = normalizeSpouseSexForSlot(sex);
  if (s === "F") return "wife";
  return "husband";
}

/**
 * Desired spouse family links (family ids only). Slot is derived from the individual's stored `sex`
 * (Male → husband, Female → wife). Removes this individual from any partner slot on families not listed.
 */
export async function syncIndividualSpouseFamilies(
  ctx: ChangeCtx,
  individualId: string,
  desired: { familyId: string }[],
) {
  const { tx, fileUuid } = ctx;
  const ind = await tx.gedcomIndividual.findUnique({
    where: { id: individualId },
    select: { sex: true },
  });
  if (!ind) throw new Error("Individual not found");
  const role = spouseSlotFromSex(ind.sex);

  const currentFamilies = await tx.gedcomFamily.findMany({
    where: {
      fileUuid,
      OR: [{ husbandId: individualId }, { wifeId: individualId }],
    },
    select: { id: true, husbandId: true, wifeId: true },
  });

  const desiredIds = new Set(desired.map((d) => d.familyId));

  for (const fam of currentFamilies) {
    if (desiredIds.has(fam.id)) continue;
    const data: { husbandId?: null; wifeId?: null } = {};
    if (fam.husbandId === individualId) data.husbandId = null;
    if (fam.wifeId === individualId) data.wifeId = null;
    if (Object.keys(data).length === 0) continue;
    await tx.gedcomFamily.update({ where: { id: fam.id }, data });
    await rebuildSpouseRowsForFamily(ctx, fam.id);
    await syncFamilySpouseXrefs(tx, fam.id);
  }

  for (const row of desired) {
    const fam = await tx.gedcomFamily.findFirst({
      where: { id: row.familyId, fileUuid },
      select: { id: true, husbandId: true, wifeId: true },
    });
    if (!fam) throw new Error(`Family ${row.familyId} not found in this tree`);

    if (role === "husband") {
      if (fam.wifeId === individualId) {
        throw new Error("Cannot add as husband: already wife in this family");
      }
      if (fam.husbandId && fam.husbandId !== individualId) {
        throw new Error("Family already has a different husband");
      }
      await tx.gedcomFamily.update({
        where: { id: fam.id },
        data: { husbandId: individualId },
      });
    } else {
      if (fam.husbandId === individualId) {
        throw new Error("Cannot add as wife: already husband in this family");
      }
      if (fam.wifeId && fam.wifeId !== individualId) {
        throw new Error("Family already has a different wife");
      }
      await tx.gedcomFamily.update({
        where: { id: fam.id },
        data: { wifeId: individualId },
      });
    }
    await rebuildSpouseRowsForFamily(ctx, fam.id);
    await syncFamilySpouseXrefs(tx, fam.id);
  }
}

/**
 * Replace child-of-family links for this individual with the given set.
 */
export async function syncIndividualChildFamilies(
  ctx: ChangeCtx,
  individualId: string,
  desired: {
    familyId: string;
    relationshipType: string;
    pedigree?: string | null;
    birthOrder?: number | null;
    /** When set, overrides `relationshipType` for the child–husband parent link only. */
    relationshipToHusband?: string | null;
    /** When set, overrides `relationshipType` for the child–wife parent link only. */
    relationshipToWife?: string | null;
  }[],
) {
  const { tx, fileUuid } = ctx;
  const currentRows = await tx.gedcomFamilyChild.findMany({
    where: { fileUuid, childId: individualId },
    select: { id: true, familyId: true },
  });

  const desiredIds = new Set(desired.map((d) => d.familyId));

  for (const row of currentRows) {
    if (desiredIds.has(row.familyId)) continue;
    await tx.gedcomFamilyChild.deleteMany({ where: { id: row.id } });
    await tx.gedcomParentChild.deleteMany({
      where: { fileUuid, childId: individualId, familyId: row.familyId },
    });
  }

  for (const row of desired) {
    const fam = await tx.gedcomFamily.findFirst({
      where: { id: row.familyId, fileUuid },
      select: { id: true, husbandId: true, wifeId: true },
    });
    if (!fam) throw new Error(`Family ${row.familyId} not found in this tree`);

    const defaultRel = normalizeChildRelationshipType(row.relationshipType);
    const relHusband = normalizeChildRelationshipType(
      row.relationshipToHusband != null && String(row.relationshipToHusband).trim() !== ""
        ? String(row.relationshipToHusband)
        : row.relationshipType,
    );
    const relWife = normalizeChildRelationshipType(
      row.relationshipToWife != null && String(row.relationshipToWife).trim() !== ""
        ? String(row.relationshipToWife)
        : row.relationshipType,
    );
    const pedigree = row.pedigree?.trim() ? row.pedigree.trim() : null;
    const birthOrder = row.birthOrder != null && Number.isFinite(row.birthOrder) ? Math.trunc(row.birthOrder) : null;

    await tx.gedcomFamilyChild.upsert({
      where: {
        fileUuid_familyId_childId: { fileUuid, familyId: fam.id, childId: individualId },
      },
      create: {
        fileUuid,
        familyId: fam.id,
        childId: individualId,
        birthOrder,
      },
      update: { birthOrder },
    });

    const parents = [fam.husbandId, fam.wifeId].filter((x): x is string => !!x);
    for (const parentId of parents) {
      const rel =
        parentId === fam.husbandId ? relHusband : parentId === fam.wifeId ? relWife : defaultRel;
      await tx.gedcomParentChild.upsert({
        where: {
          fileUuid_parentId_childId: { fileUuid, parentId, childId: individualId },
        },
        create: {
          fileUuid,
          parentId,
          childId: individualId,
          familyId: fam.id,
          relationshipType: rel,
          pedigree,
        },
        update: {
          familyId: fam.id,
          relationshipType: rel,
          pedigree,
        },
      });
    }
  }
}

export async function recomputeIndividualFamilyFlags(ctx: ChangeCtx, individualId: string) {
  const { tx, fileUuid } = ctx;
  const [spouseCount, childLinkCount, parentCount] = await Promise.all([
    tx.gedcomFamily.count({
      where: { fileUuid, OR: [{ husbandId: individualId }, { wifeId: individualId }] },
    }),
    tx.gedcomParentChild.count({
      where: { fileUuid, parentId: individualId },
    }),
    tx.gedcomParentChild.count({
      where: { fileUuid, childId: individualId },
    }),
  ]);

  await tx.gedcomIndividual.update({
    where: { id: individualId },
    data: {
      hasSpouse: spouseCount > 0,
      hasChildren: childLinkCount > 0,
      hasParents: parentCount > 0,
    },
  });
}
