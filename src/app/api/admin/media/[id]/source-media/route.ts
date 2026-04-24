import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const sourceSelect = {
  id: true,
  title: true,
  xref: true,
} as const;

export const POST = withAdminAuth(async (request, _user, ctx) => {
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

  try {
    const row = await prisma.gedcomSourceMedia.create({
      data: { fileUuid, sourceId, mediaId },
      include: { source: { select: sourceSelect } },
    });
    return NextResponse.json({ sourceMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that source" }, { status: 409 });
  }
});
