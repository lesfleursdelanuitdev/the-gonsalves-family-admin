import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
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

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const album = await prisma.album.findFirst({
    where: { id: albumId, userId: user.id },
    select: { id: true, name: true },
  });
  if (!album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  try {
    const row = await prisma.albumGedcomMedia.create({
      data: {
        albumId,
        gedcomMediaId: mediaId,
        addedBy: user.id,
      },
      include: { album: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ albumLink: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already in that album" }, { status: 409 });
  }
});
