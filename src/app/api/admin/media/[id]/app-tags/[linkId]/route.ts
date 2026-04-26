import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionUnlink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const DELETE = withAdminAuth(async (_request, user, ctx) => {
  const { id: mediaId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const existing = await prisma.gedcomMediaAppTag.findFirst({
    where: { id: linkId, gedcomMediaId: mediaId, taggedBy: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tag link not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await commitMediaJunctionUnlink(changeCtx, "media_app_tag", existing, "Removed media app tag");
    await tx.gedcomMediaAppTag.delete({ where: { id: linkId } });
  });
  return NextResponse.json({ success: true });
});
