import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionUnlink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const DELETE = withAdminAuth(async (_request, user, ctx) => {
  const { id: userMediaId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) {
    return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  }

  const media = await prisma.userMedia.findFirst({
    where: { id: userMediaId, userId: user.id, treeId: tree.id, deletedAt: null },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "User media not found" }, { status: 404 });
  }

  const existing = await prisma.albumUserMedia.findFirst({
    where: {
      id: linkId,
      userMediaId,
      album: { OR: [{ userId: user.id }, { userId: null, treeId: tree.id }] },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Album link not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await commitMediaJunctionUnlink(changeCtx, "album_user_media", existing, "Removed user media from album");
    await tx.albumUserMedia.delete({ where: { id: linkId } });
  });
  return NextResponse.json({ success: true });
});
