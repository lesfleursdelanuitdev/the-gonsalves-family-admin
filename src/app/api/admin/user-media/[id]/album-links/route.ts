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
  const albumId = typeof body.albumId === "string" ? body.albumId.trim() : "";
  if (!albumId) {
    return NextResponse.json({ error: "albumId is required" }, { status: 400 });
  }

  const batchId = newBatchId();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const media = await tx.userMedia.findFirst({
        where: { id: userMediaId, userId: user.id, treeId: tree.id, deletedAt: null },
        select: { id: true },
      });
      if (!media) throw new Error("MEDIA_NOT_FOUND");

      const album = await tx.album.findFirst({
        where: {
          id: albumId,
          OR: [{ userId: user.id }, { userId: null, treeId: tree.id }],
        },
        select: { id: true, name: true },
      });
      if (!album) throw new Error("ALBUM_NOT_FOUND");

      const created = await tx.albumUserMedia.create({
        data: { albumId, userMediaId, addedBy: user.id },
        include: { album: { select: { id: true, name: true } } },
      });
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      await commitMediaJunctionLink(
        changeCtx,
        "album_user_media",
        created,
        `Added my media to album “${created.album.name}”`,
      );
      return created;
    });
    return NextResponse.json({ albumLink: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "MEDIA_NOT_FOUND") {
      return NextResponse.json({ error: "User media not found" }, { status: 404 });
    }
    if (msg === "ALBUM_NOT_FOUND") {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "This media is already in that album" }, { status: 409 });
  }
});
