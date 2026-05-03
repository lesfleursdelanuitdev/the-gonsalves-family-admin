import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { tagMayMutate } from "@/lib/admin/tag-admin-access";
import { gedcomMediaWithAppTagsInclude } from "@/lib/admin/gedcom-media-with-tags-include";

export const PUT = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json()) as { mediaId?: unknown };
  const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const tag = await prisma.tag.findFirst({
    where: { id, OR: [{ isGlobal: true }, { userId: user.id }] },
    select: { id: true, isGlobal: true, userId: true },
  });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  if (!tagMayMutate(tag, user)) {
    return NextResponse.json(
      {
        error: tag.isGlobal
          ? "Only a site owner can change global tags."
          : "You can only change tags you own.",
      },
      { status: 403 },
    );
  }

  const fileUuid = await getAdminFileUuid();
  const [entity, media] = await Promise.all([
    prisma.tag.findFirst({ where: { id }, select: { id: true } }),
    prisma.gedcomMedia.findFirst({ where: { id: mediaId, fileUuid }, select: { id: true } }),
  ]);
  if (!entity) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  if (!media) {
    return NextResponse.json({ error: "Media not found in this tree" }, { status: 404 });
  }

  await prisma.tagProfileMedia.upsert({
    where: { tagId_fileUuid: { tagId: id, fileUuid } },
    create: { tagId: id, fileUuid, mediaId },
    update: { mediaId, fileUuid },
  });

  const row = await prisma.tagProfileMedia.findUnique({
    where: { tagId_fileUuid: { tagId: id, fileUuid } },
    include: { media: gedcomMediaWithAppTagsInclude },
  });

  return NextResponse.json({ profileMediaSelection: row });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;

  const tag = await prisma.tag.findFirst({
    where: { id, OR: [{ isGlobal: true }, { userId: user.id }] },
    select: { id: true, isGlobal: true, userId: true },
  });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  if (!tagMayMutate(tag, user)) {
    return NextResponse.json(
      {
        error: tag.isGlobal
          ? "Only a site owner can change global tags."
          : "You can only change tags you own.",
      },
      { status: 403 },
    );
  }

  const fileUuid = await getAdminFileUuid();
  await prisma.tagProfileMedia.deleteMany({ where: { tagId: id, fileUuid } });
  return NextResponse.json({ success: true });
});
