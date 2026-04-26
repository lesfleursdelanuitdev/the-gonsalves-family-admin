import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const POST = withAdminAuth(async (request, user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const albumId = typeof body.albumId === "string" ? body.albumId.trim() : "";
  if (!albumId) {
    return NextResponse.json({ error: "albumId is required" }, { status: 400 });
  }

  const batchId = newBatchId();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const media = await tx.gedcomMedia.findFirst({
        where: { id: mediaId, fileUuid },
        select: { id: true },
      });
      if (!media) {
        throw new Error("MEDIA_NOT_FOUND");
      }

      const album = await tx.album.findFirst({
        where: { id: albumId, userId: user.id },
        select: { id: true, name: true },
      });
      if (!album) {
        throw new Error("ALBUM_NOT_FOUND");
      }

      const created = await tx.albumGedcomMedia.create({
        data: {
          albumId,
          gedcomMediaId: mediaId,
          addedBy: user.id,
        },
        include: { album: { select: { id: true, name: true } } },
      });
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      await commitMediaJunctionLink(
        changeCtx,
        "album_gedcom_media",
        created,
        `Added media to album “${created.album.name}”`,
      );
      return created;
    });
    return NextResponse.json({ albumLink: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "MEDIA_NOT_FOUND") {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    if (msg === "ALBUM_NOT_FOUND") {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "This media is already in that album" }, { status: 409 });
  }
});
