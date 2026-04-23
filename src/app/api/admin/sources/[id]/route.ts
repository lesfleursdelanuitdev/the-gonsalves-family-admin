import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import {
  logDelete,
  logUpdate,
  newBatchId,
  setBatchSummary,
  type ChangeCtx,
} from "@/lib/admin/changelog";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const source = await prisma.gedcomSource.findFirst({
    where: { id, fileUuid },
    include: {
      individualSources: {
        include: {
          individual: { select: { id: true, fullName: true, xref: true } },
        },
      },
      familySources: {
        include: {
          family: {
            select: {
              id: true,
              xref: true,
              husband: { select: { fullName: true } },
              wife: { select: { fullName: true } },
            },
          },
        },
      },
      eventSources: { include: { event: { select: { id: true, eventType: true } } } },
      sourceNotes: { include: { note: { select: { id: true, xref: true, content: true } } } },
      sourceMedia: { include: { media: { select: { id: true, title: true, fileRef: true } } } },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json({ source });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = await req.json();

  const existing = await prisma.gedcomSource.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const allowed = [
    "title",
    "author",
    "abbreviation",
    "publication",
    "text",
    "repositoryXref",
    "callNumber",
  ] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const batchId = newBatchId();
  const source = await prisma.$transaction(async (tx) => {
    const ctx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    const updated = await tx.gedcomSource.update({ where: { id }, data });
    await logUpdate(ctx, "source", id, existing.xref, { ...existing }, { ...updated });
    await setBatchSummary(ctx, `Updated source ${existing.xref}`);
    return updated;
  });

  return NextResponse.json({ source });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomSource.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const ctx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await tx.gedcomIndividualSource.deleteMany({ where: { sourceId: id } });
    await tx.gedcomFamilySource.deleteMany({ where: { sourceId: id } });
    await tx.gedcomEventSource.deleteMany({ where: { sourceId: id } });
    await tx.gedcomSourceNote.deleteMany({ where: { sourceId: id } });
    await tx.gedcomSourceMedia.deleteMany({ where: { sourceId: id } });
    await tx.gedcomSourceRepository.deleteMany({ where: { sourceId: id } });
    await tx.gedcomSource.delete({ where: { id } });
    await logDelete(ctx, "source", id, existing.xref, { ...existing });
    await setBatchSummary(ctx, `Deleted source ${existing.xref}`);
  });

  return new NextResponse(null, { status: 204 });
});
