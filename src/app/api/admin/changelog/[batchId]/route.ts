import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { batchId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const entries = await prisma.changeLog.findMany({
    where: { batchId, fileUuid },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, username: true, name: true } },
    },
  });

  if (entries.length === 0) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({
    batchId,
    summary: entries[0]?.summary ?? null,
    createdAt: entries[0]?.createdAt,
    userId: entries[0]?.userId,
    user: entries[0]?.user,
    undoneAt: entries[0]?.undoneAt ?? null,
    undoneBy: entries[0]?.undoneBy ?? null,
    entries: entries.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      entityXref: e.entityXref,
      operation: e.operation,
      changeset: e.changeset,
      createdAt: e.createdAt,
    })),
  });
});
