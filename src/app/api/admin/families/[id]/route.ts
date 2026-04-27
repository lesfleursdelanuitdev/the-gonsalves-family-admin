import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { mergeFamilyChildrenForApi } from "@/lib/admin/admin-family-children-merge";
import { upsertFamilyDivorceFact, upsertFamilyMarriageFact } from "@/lib/admin/admin-family-marriage";
import {
  findExistingCoupleFamilyId,
  rebuildSpouseRowsForFamily,
  syncFamilySpouseXrefs,
} from "@/lib/admin/admin-individual-families";
import { deleteGedcomFamilyWithCleanup } from "@/lib/admin/admin-family-delete";
import { newBatchId } from "@/lib/admin/changelog";
import { ADMIN_FAMILY_DETAIL_INCLUDE } from "@/app/api/admin/families/family-admin-detail-include";
import type { PrismaClient } from "@ligneous/prisma";

async function loadFamilyForAdminResponse(db: PrismaClient, fileUuid: string, id: string) {
  const family = await db.gedcomFamily.findFirst({
    where: { id, fileUuid },
    include: ADMIN_FAMILY_DETAIL_INCLUDE,
  });
  if (!family) return null;
  const familyChildren = await mergeFamilyChildrenForApi(db, fileUuid, family);
  return { ...family, familyChildren };
}

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const merged = await loadFamilyForAdminResponse(prisma, fileUuid, id);
  if (!merged) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  return NextResponse.json({ family: merged });
});

const ALLOWED_UPDATE_FIELDS = new Set([
  "husbandId",
  "wifeId",
  "husbandXref",
  "wifeXref",
  "marriageYear",
  "marriageDateDisplay",
  "marriagePlaceDisplay",
  "isDivorced",
  "childrenCount",
]);

const MARRIAGE_DENORM_FIELDS = new Set([
  "marriageYear",
  "marriageDateDisplay",
  "marriagePlaceDisplay",
]);

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomFamily.findFirst({
    where: { id, fileUuid },
    select: { id: true, husbandId: true, wifeId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const hasMarriage = Object.prototype.hasOwnProperty.call(body, "marriage");
  const hasDivorce = Object.prototype.hasOwnProperty.call(body, "divorce");

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_UPDATE_FIELDS.has(key)) continue;
    if (hasMarriage && MARRIAGE_DENORM_FIELDS.has(key)) continue;
    data[key] = value;
  }

  if (!hasMarriage && !hasDivorce && Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const touchesPartnerSlots =
    Object.prototype.hasOwnProperty.call(data, "husbandId") ||
    Object.prototype.hasOwnProperty.call(data, "wifeId");
  let nextHusbandId = existing.husbandId;
  let nextWifeId = existing.wifeId;
  if (touchesPartnerSlots) {
    if (Object.prototype.hasOwnProperty.call(data, "husbandId")) {
      const v = data.husbandId;
      nextHusbandId = v == null || v === "" ? null : String(v);
    }
    if (Object.prototype.hasOwnProperty.call(data, "wifeId")) {
      const v = data.wifeId;
      nextWifeId = v == null || v === "" ? null : String(v);
    }
    if (!nextHusbandId && !nextWifeId) {
      return NextResponse.json(
        {
          error:
            "Cannot clear both parents. Keep at least one husband or wife, or delete the family instead.",
        },
        { status: 400 },
      );
    }
    if (nextHusbandId && nextWifeId) {
      const dupId = await findExistingCoupleFamilyId(
        prisma,
        fileUuid,
        nextHusbandId,
        nextWifeId,
        id,
      );
      if (dupId) {
        return NextResponse.json(
          {
            error: "A family for this couple already exists.",
            existingFamilyId: dupId,
          },
          { status: 409 },
        );
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const changeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
      if (hasMarriage) {
        await upsertFamilyMarriageFact(changeCtx, id, body.marriage);
      }
      if (hasDivorce) {
        await upsertFamilyDivorceFact(changeCtx, id, body.divorce);
      }
      if (Object.keys(data).length > 0) {
        data.updatedAt = new Date();
        await tx.gedcomFamily.update({
          where: { id },
          data: data as Record<string, unknown>,
        });
      } else if (hasMarriage || hasDivorce) {
        await tx.gedcomFamily.update({
          where: { id },
          data: { updatedAt: new Date() },
        });
      }
      if (data.husbandId !== undefined || data.wifeId !== undefined) {
        await rebuildSpouseRowsForFamily(changeCtx, id);
        await syncFamilySpouseXrefs(tx, id);
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const merged = await loadFamilyForAdminResponse(prisma, fileUuid, id);
  if (!merged) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
  return NextResponse.json({ family: merged });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomFamily.findFirst({
    where: { id, fileUuid },
    select: {
      id: true,
      marriageDateId: true,
      marriagePlaceId: true,
      divorceDateId: true,
      divorcePlaceId: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await deleteGedcomFamilyWithCleanup(
      { tx, fileUuid, userId: user.id, batchId: newBatchId() },
      existing,
    );
  });

  return NextResponse.json({ success: true });
});
