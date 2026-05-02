import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const POST = withAdminAuth(async (request, user, ctx) => {
  const { id: userMediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) {
    return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const tagId = typeof body.tagId === "string" ? body.tagId.trim() : "";
  if (!tagId) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  const batchId = newBatchId();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const media = await tx.userMedia.findFirst({
        where: { id: userMediaId, userId: user.id, treeId: tree.id, deletedAt: null },
        select: { id: true },
      });
      if (!media) throw new Error("MEDIA_NOT_FOUND");

      const tagOk = await tx.tag.findFirst({
        where: { id: tagId, OR: [{ isGlobal: true }, { userId: user.id }] },
        select: { id: true },
      });
      if (!tagOk) throw new Error("TAG_NOT_ALLOWED");

      const created = await tx.userMediaTag.create({
        data: { tagId, userMediaId, taggedBy: user.id },
        include: { tag: { select: { id: true, name: true, color: true } } },
      });
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      await commitMediaJunctionLink(
        changeCtx,
        "user_media_tag",
        created,
        `Tagged my media with “${created.tag.name}”`,
      );
      return created;
    });
    return NextResponse.json({ appTag: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "MEDIA_NOT_FOUND") {
      return NextResponse.json({ error: "User media not found" }, { status: 404 });
    }
    if (msg === "TAG_NOT_ALLOWED") {
      return NextResponse.json({ error: "Tag not found or not allowed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Tag already applied for this user" }, { status: 409 });
  }
});
