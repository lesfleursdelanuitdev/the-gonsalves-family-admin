import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { mergeFamilyChildrenForApi } from "@/lib/admin/admin-family-children-merge";
import {
  addChildToFamily,
  addParentToFamily,
  removeChildFromFamily,
  removeParentFromFamily,
} from "@/lib/admin/admin-family-membership";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { createIndividualFromEditorPayload } from "@/lib/admin/admin-individual-editor-apply";
import { parseIndividualEditorPayload } from "@/lib/forms/individual-editor-payload";
import { ADMIN_FAMILY_DETAIL_INCLUDE } from "@/app/api/admin/families/family-admin-detail-include";

async function loadFamilyMerged(fileUuid: string, id: string) {
  const family = await prisma.gedcomFamily.findFirst({
    where: { id, fileUuid },
    include: ADMIN_FAMILY_DETAIL_INCLUDE,
  });
  if (!family) return null;
  const familyChildren = await mergeFamilyChildrenForApi(prisma, fileUuid, family);
  return { ...family, familyChildren };
}

export const POST = withAdminAuth(async (req, user, ctx) => {
  const { id: familyId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "addParent") {
      const individualId = typeof body.individualId === "string" ? body.individualId.trim() : "";
      if (!individualId) {
        return NextResponse.json({ error: "individualId is required" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
        await addParentToFamily(changeCtx, familyId, individualId);
      });
    } else if (action === "removeParent") {
      const slot = body.slot === "wife" ? "wife" : body.slot === "husband" ? "husband" : "";
      if (slot !== "husband" && slot !== "wife") {
        return NextResponse.json({ error: "slot must be husband or wife" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
        await removeParentFromFamily(changeCtx, familyId, slot);
      });
    } else if (action === "addChild") {
      const childId = typeof body.childId === "string" ? body.childId.trim() : "";
      if (!childId) {
        return NextResponse.json({ error: "childId is required" }, { status: 400 });
      }
      const birthOrder =
        typeof body.birthOrder === "number" && Number.isFinite(body.birthOrder)
          ? Math.trunc(body.birthOrder)
          : null;
      const relationshipType =
        typeof body.relationshipType === "string" ? body.relationshipType : "biological";
      await prisma.$transaction(async (tx) => {
        const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
        await addChildToFamily(changeCtx, familyId, childId, { birthOrder, relationshipType });
      });
    } else if (action === "removeChild") {
      const childId = typeof body.childId === "string" ? body.childId.trim() : "";
      if (!childId) {
        return NextResponse.json({ error: "childId is required" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
        await removeChildFromFamily(changeCtx, familyId, childId);
      });
    } else if (action === "createParentAndAdd") {
      const inner = body.individual;
      if (!inner || typeof inner !== "object") {
        return NextResponse.json({ error: "individual object is required" }, { status: 400 });
      }
      const parsed = parseIndividualEditorPayload(inner as Record<string, unknown>);
      await prisma.$transaction(async (tx) => {
        const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
        const newId = await createIndividualFromEditorPayload(changeCtx, parsed);
        await addParentToFamily(changeCtx, familyId, newId);
      });
    } else if (action === "createChildAndAdd") {
      const inner = body.individual;
      if (!inner || typeof inner !== "object") {
        return NextResponse.json({ error: "individual object is required" }, { status: 400 });
      }
      const parsed = parseIndividualEditorPayload(inner as Record<string, unknown>);
      const birthOrder =
        typeof body.birthOrder === "number" && Number.isFinite(body.birthOrder)
          ? Math.trunc(body.birthOrder)
          : null;
      const relationshipType =
        typeof body.relationshipType === "string" ? body.relationshipType : "biological";
      await prisma.$transaction(async (tx) => {
        const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
        const newId = await createIndividualFromEditorPayload(changeCtx, parsed);
        await addChildToFamily(changeCtx, familyId, newId, { birthOrder, relationshipType });
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Unknown action. Use addParent, removeParent, addChild, removeChild, createParentAndAdd, or createChildAndAdd.",
        },
        { status: 400 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Membership update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const family = await loadFamilyMerged(fileUuid, familyId);
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
  return NextResponse.json({ family });
});
