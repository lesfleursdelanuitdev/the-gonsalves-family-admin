import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionUnlink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id: mediaId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomEventMedia.findFirst({
    where: { id: linkId, mediaId, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await commitMediaJunctionUnlink(changeCtx, "event_media", existing, "Removed event–media link");
    await tx.gedcomEventMedia.delete({ where: { id: linkId } });
  });
  return NextResponse.json({ success: true });
});
