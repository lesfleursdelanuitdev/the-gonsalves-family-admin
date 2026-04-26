import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const sourceSelect = {
  id: true,
  title: true,
  xref: true,
} as const;

export const POST = withAdminAuth(async (request, user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const source = await prisma.gedcomSource.findFirst({
    where: { id: sourceId, fileUuid },
    select: { id: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Source not found in this tree" }, { status: 404 });
  }

  const batchId = newBatchId();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      const created = await tx.gedcomSourceMedia.create({
        data: { fileUuid, sourceId, mediaId },
        include: { source: { select: sourceSelect } },
      });
      const label = created.source.title?.trim() || created.source.xref?.trim() || sourceId;
      await commitMediaJunctionLink(changeCtx, "source_media", created, `Linked media to source ${label}`);
      return created;
    });
    return NextResponse.json({ sourceMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that source" }, { status: 409 });
  }
});
