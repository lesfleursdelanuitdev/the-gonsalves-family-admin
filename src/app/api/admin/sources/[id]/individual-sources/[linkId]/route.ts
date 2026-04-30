import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { commitMediaJunctionUnlink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id: sourceId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomIndividualSource.findFirst({
    where: { id: linkId, sourceId, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Citation link not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await commitMediaJunctionUnlink(changeCtx, "individual_source", existing, "Removed person citation");
    await tx.gedcomIndividualSource.delete({ where: { id: linkId } });
  });

  return NextResponse.json({ success: true });
});
