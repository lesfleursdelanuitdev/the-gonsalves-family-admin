import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { commitMediaJunctionUnlink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  await requireCan({ entity: "source", action: "update", scope: "tree" });
  const { id: eventId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomEventSource.findFirst({
    where: { id: linkId, eventId, fileUuid },
  });
  if (!existing) return NextResponse.json({ error: "Citation link not found" }, { status: 404 });

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await commitMediaJunctionUnlink(changeCtx, "event_source", existing, "Removed event citation");
    await tx.gedcomEventSource.delete({ where: { id: linkId } });
  });

  return NextResponse.json({ success: true });
});
