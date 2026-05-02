import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionUnlink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const DELETE = withAdminAuth(async (_request, user, ctx) => {
  const { id: siteMediaId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) {
    return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  }

  const media = await prisma.siteMedia.findFirst({
    where: { id: siteMediaId, treeId: tree.id, deletedAt: null },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Site media not found" }, { status: 404 });
  }

  const existing = await prisma.albumSiteMedia.findFirst({
    where: {
      id: linkId,
      siteMediaId,
      album: { OR: [{ userId: user.id }, { userId: null, treeId: tree.id }] },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Album link not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await commitMediaJunctionUnlink(changeCtx, "album_site_media", existing, "Removed site media from album");
    await tx.albumSiteMedia.delete({ where: { id: linkId } });
  });
  return NextResponse.json({ success: true });
});
