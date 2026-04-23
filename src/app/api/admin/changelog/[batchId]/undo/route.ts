import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { newBatchId } from "@/lib/admin/changelog";
import { undoBatch } from "@/lib/admin/changelog-undo";

export const POST = withAdminAuth(async (_req, user, ctx) => {
  const { batchId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const entries = await prisma.changeLog.findMany({
    where: { batchId, fileUuid },
    select: { id: true, undoneAt: true },
  });

  if (entries.length === 0) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (entries.some((e) => e.undoneAt != null)) {
    return NextResponse.json({ error: "Batch has already been undone" }, { status: 409 });
  }

  const undoBid = newBatchId();

  try {
    await prisma.$transaction(
      async (tx) => {
        await undoBatch(tx, fileUuid, batchId, user.id, undoBid);
      },
      { timeout: 30000 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Undo failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    undoBatchId: undoBid,
  });
});
