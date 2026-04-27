import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { sanitizeExportBasename } from "@/lib/admin/export-filename";
import { startAlbumZipStream, type AlbumZipMediaInput } from "@/lib/admin/stream-album-zip";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const maxDuration = 300;

const MEDIA_SELECT = {
  id: true,
  fileRef: true,
  form: true,
  title: true,
  xref: true,
} as const;

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { id: albumId } = await ctx.params;

  const album = await prisma.album.findFirst({
    where: { id: albumId, userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      coverMediaId: true,
    },
  });

  if (!album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const fileUuid = await getAdminFileUuid();

  const links = await prisma.albumGedcomMedia.findMany({
    where: { albumId, gedcomMedia: { fileUuid } },
    orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }],
    select: { gedcomMedia: { select: MEDIA_SELECT } },
  });

  const mediaOrdered: AlbumZipMediaInput[] = [];
  const seen = new Set<string>();
  for (const row of links) {
    const m = row.gedcomMedia;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    mediaOrdered.push({
      id: m.id,
      fileRef: m.fileRef,
      form: m.form,
      title: m.title,
      xref: m.xref,
      role: "album_member",
    });
  }

  if (album.coverMediaId && !seen.has(album.coverMediaId)) {
    const cover = await prisma.gedcomMedia.findFirst({
      where: { id: album.coverMediaId, fileUuid },
      select: MEDIA_SELECT,
    });
    if (cover) {
      mediaOrdered.push({
        id: cover.id,
        fileRef: cover.fileRef,
        form: cover.form,
        title: cover.title,
        xref: cover.xref,
        role: "cover_only",
      });
    }
  }

  const pass = startAlbumZipStream({
    album: {
      id: album.id,
      name: album.name,
      description: album.description,
      isPublic: album.isPublic,
      coverMediaId: album.coverMediaId,
    },
    media: mediaOrdered,
    treeFileUuid: fileUuid,
  });

  const base = sanitizeExportBasename(album.name, "album");
  const filename = `${base}-album.zip`;

  const webStream = Readable.toWeb(pass) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
