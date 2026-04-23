import type { Prisma } from "@ligneous/prisma";
import type { ChangeCtx } from "@/lib/admin/changelog";
import {
  canonicalSpouseSlotsForPair,
  normalizeChildRelationshipType,
  rebuildSpouseRowsForFamily,
  recomputeIndividualFamilyFlags,
  singleSpouseSlotForFirstParent,
  syncFamilySpouseXrefs,
} from "@/lib/admin/admin-individual-families";

type Tx = Prisma.TransactionClient;

async function syncFamilyChildrenCount(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  const n = await tx.gedcomFamilyChild.count({ where: { fileUuid, familyId } });
  await tx.gedcomFamily.update({ where: { id: familyId }, data: { childrenCount: n } });
}

async function recomputeFlagsForFamilyMembers(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  const fam = await tx.gedcomFamily.findUnique({
    where: { id: familyId },
    select: { husbandId: true, wifeId: true },
  });
  const ids = new Set<string>();
  if (fam?.husbandId) ids.add(fam.husbandId);
  if (fam?.wifeId) ids.add(fam.wifeId);
  const children = await tx.gedcomFamilyChild.findMany({
    where: { familyId },
    select: { childId: true },
  });
  for (const c of children) ids.add(c.childId);
  for (const id of ids) {
    await recomputeIndividualFamilyFlags(ctx, id);
  }
}

export async function addParentToFamily(ctx: ChangeCtx, familyId: string, individualId: string) {
  const { tx, fileUuid } = ctx;
  const fam = await tx.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true, husbandId: true, wifeId: true },
  });
  if (!fam) throw new Error("Family not found");

  const asChild = await tx.gedcomFamilyChild.findFirst({
    where: { familyId, childId: individualId, fileUuid },
  });
  if (asChild) throw new Error("This person is already a child of this family");

  if (fam.husbandId === individualId || fam.wifeId === individualId) {
    throw new Error("This person is already a parent in this family");
  }

  const ind = await tx.gedcomIndividual.findFirst({
    where: { id: individualId, fileUuid },
    select: { id: true, sex: true },
  });
  if (!ind) throw new Error("Individual not found");

  const hId = fam.husbandId;
  const wId = fam.wifeId;
  const hasH = !!hId;
  const hasW = !!wId;

  if (hasH && hasW) {
    throw new Error("Family already has both parents");
  }

  let nextHusbandId: string | null;
  let nextWifeId: string | null;

  if (!hasH && !hasW) {
    const slot = singleSpouseSlotForFirstParent(ind.sex);
    if (slot === "husband") {
      nextHusbandId = individualId;
      nextWifeId = null;
    } else {
      nextHusbandId = null;
      nextWifeId = individualId;
    }
  } else {
    const existingId = hasH ? hId! : wId!;
    const existing = await tx.gedcomIndividual.findFirst({
      where: { id: existingId, fileUuid },
      select: { id: true, sex: true },
    });
    if (!existing) throw new Error("Existing parent individual not found");
    const canon = canonicalSpouseSlotsForPair(
      { id: existing.id, sex: existing.sex },
      { id: ind.id, sex: ind.sex },
    );
    nextHusbandId = canon.husbandId;
    nextWifeId = canon.wifeId;
  }

  await tx.gedcomFamily.update({
    where: { id: familyId },
    data: { husbandId: nextHusbandId, wifeId: nextWifeId },
  });

  await rebuildSpouseRowsForFamily(ctx, familyId);
  await syncFamilySpouseXrefs(tx, familyId);

  const children = await tx.gedcomFamilyChild.findMany({
    where: { familyId, fileUuid },
    select: { childId: true },
  });
  const updatedFam = await tx.gedcomFamily.findUnique({
    where: { id: familyId },
    select: { husbandId: true, wifeId: true },
  });
  const parents = [updatedFam!.husbandId, updatedFam!.wifeId].filter((x): x is string => !!x);
  for (const { childId } of children) {
    for (const parentId of parents) {
      await tx.gedcomParentChild.upsert({
        where: { fileUuid_parentId_childId: { fileUuid, parentId, childId } },
        create: {
          fileUuid,
          parentId,
          childId,
          familyId,
          relationshipType: "biological",
          pedigree: null,
        },
        update: { familyId },
      });
    }
  }

  await recomputeIndividualFamilyFlags(ctx, individualId);
  await recomputeFlagsForFamilyMembers(ctx, familyId);
}

export async function removeParentFromFamily(
  ctx: ChangeCtx,
  familyId: string,
  slot: "husband" | "wife",
) {
  const { tx, fileUuid } = ctx;
  const fam = await tx.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true, husbandId: true, wifeId: true },
  });
  if (!fam) throw new Error("Family not found");

  const hasH = !!fam.husbandId;
  const hasW = !!fam.wifeId;
  if (slot === "husband") {
    if (!hasH) throw new Error("No parent in husband slot");
    if (!hasW) throw new Error("Cannot remove the only parent");
    const removedId = fam.husbandId!;
    await tx.gedcomFamily.update({ where: { id: familyId }, data: { husbandId: null, husbandXref: null } });
    await tx.gedcomParentChild.deleteMany({
      where: { fileUuid, familyId, parentId: removedId },
    });
    await recomputeIndividualFamilyFlags(ctx, removedId);
  } else {
    if (!hasW) throw new Error("No parent in wife slot");
    if (!hasH) throw new Error("Cannot remove the only parent");
    const removedId = fam.wifeId!;
    await tx.gedcomFamily.update({ where: { id: familyId }, data: { wifeId: null, wifeXref: null } });
    await tx.gedcomParentChild.deleteMany({
      where: { fileUuid, familyId, parentId: removedId },
    });
    await recomputeIndividualFamilyFlags(ctx, removedId);
  }

  await rebuildSpouseRowsForFamily(ctx, familyId);
  await recomputeFlagsForFamilyMembers(ctx, familyId);
}

export async function addChildToFamily(
  ctx: ChangeCtx,
  familyId: string,
  childId: string,
  opts?: { birthOrder?: number | null; relationshipType?: string },
) {
  const { tx, fileUuid } = ctx;
  const fam = await tx.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true, husbandId: true, wifeId: true },
  });
  if (!fam) throw new Error("Family not found");

  if (fam.husbandId === childId || fam.wifeId === childId) {
    throw new Error("A parent cannot be added as a child of the same family");
  }

  const exists = await tx.gedcomFamilyChild.findUnique({
    where: { fileUuid_familyId_childId: { fileUuid, familyId, childId } },
  });
  if (exists) throw new Error("This person is already a child of this family");

  const rel = normalizeChildRelationshipType(opts?.relationshipType ?? "biological");
  const birthOrder = opts?.birthOrder != null && Number.isFinite(opts.birthOrder) ? Math.trunc(opts.birthOrder) : null;

  await tx.gedcomFamilyChild.create({
    data: { fileUuid, familyId, childId, birthOrder },
  });

  const parents = [fam.husbandId, fam.wifeId].filter((x): x is string => !!x);
  for (const parentId of parents) {
    await tx.gedcomParentChild.upsert({
      where: { fileUuid_parentId_childId: { fileUuid, parentId, childId } },
      create: {
        fileUuid,
        parentId,
        childId,
        familyId,
        relationshipType: rel,
        pedigree: null,
      },
      update: { familyId, relationshipType: rel },
    });
  }

  await syncFamilyChildrenCount(ctx, familyId);
  await recomputeIndividualFamilyFlags(ctx, childId);
  await recomputeFlagsForFamilyMembers(ctx, familyId);
}

export async function removeChildFromFamily(ctx: ChangeCtx, familyId: string, childId: string) {
  const { tx, fileUuid } = ctx;
  const row = await tx.gedcomFamilyChild.findUnique({
    where: { fileUuid_familyId_childId: { fileUuid, familyId, childId } },
  });
  if (!row) throw new Error("Child not linked to this family");

  await tx.gedcomFamilyChild.delete({ where: { id: row.id } });
  await tx.gedcomParentChild.deleteMany({
    where: { fileUuid, familyId, childId },
  });

  await syncFamilyChildrenCount(ctx, familyId);
  await recomputeIndividualFamilyFlags(ctx, childId);
  await recomputeFlagsForFamilyMembers(ctx, familyId);
}
