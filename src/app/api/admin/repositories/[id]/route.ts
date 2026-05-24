import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import {
  logDelete,
  newBatchId,
  setBatchSummary,
  type ChangeCtx,
} from "@/lib/admin/changelog";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "source", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const repository = await prisma.gedcomRepository.findFirst({
    where: { id, fileUuid },
    include: {
      sourceRepositories: {
        include: {
          source: {
            select: {
              id: true,
              xref: true,
              title: true,
              author: true,
              abbreviation: true,
              _count: {
                select: {
                  individualSources: true,
                  familySources: true,
                  eventSources: true,
                  attributeSources: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!repository) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  return NextResponse.json({ repository });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  await requireCan({ entity: "source", action: "delete", scope: "tree" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomRepository.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await tx.gedcomSourceRepository.deleteMany({ where: { repositoryId: id } });
    await tx.gedcomRepository.delete({ where: { id } });
    await logDelete(changeCtx, "source", id, existing.xref, { ...existing });
    await setBatchSummary(changeCtx, `Deleted repository ${existing.xref}`);
  });

  return new NextResponse(null, { status: 204 });
});
