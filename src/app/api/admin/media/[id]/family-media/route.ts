import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const familySelect = {
  id: true,
  xref: true,
  husband: { select: { id: true, fullName: true } },
  wife: { select: { id: true, fullName: true } },
} as const;

export const POST = withAdminAuth(async (request, user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const familyId = typeof body.familyId === "string" ? body.familyId.trim() : "";
  if (!familyId) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const family = await prisma.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true },
  });
  if (!family) {
    return NextResponse.json({ error: "Family not found in this tree" }, { status: 404 });
  }

  const batchId = newBatchId();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      const created = await tx.gedcomFamilyMedia.create({
        data: { fileUuid, familyId, mediaId },
        include: { family: { select: familySelect } },
      });
      const label = created.family.xref?.trim() || familyId;
      await commitMediaJunctionLink(changeCtx, "family_media", created, `Linked media to family ${label}`);
      return created;
    });
    return NextResponse.json({ familyMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that family" }, { status: 409 });
  }
});
