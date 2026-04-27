import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { findPublicAlbumNameConflict } from "@/lib/admin/admin-album-public-name";
import { enrichAlbumsWithCoverPreview, enrichAlbumWithCoverPreview } from "@/lib/admin/album-cover-preview";

/** Albums owned by the current user (for linking Gedcom media). */
export const GET = withAdminAuth(async (request, user) => {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const { limit, offset } = parseListParams(request.nextUrl.searchParams);

  const baseWhere = {
    userId: user.id,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [albums, total] = await Promise.all([
    prisma.album.findMany({
      where: baseWhere,
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        coverMediaId: true,
        sortOrder: true,
        updatedAt: true,
      },
      orderBy: { sortOrder: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.album.count({ where: baseWhere }),
  ]);

  const albumsWithCovers = await enrichAlbumsWithCoverPreview(albums);

  return NextResponse.json({
    albums: albumsWithCovers,
    total,
    hasMore: offset + albums.length < total,
  });
});

export const POST = withAdminAuth(async (request, user) => {
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const description =
    typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const isPublic = Boolean(body.isPublic);
  const coverRaw =
    body.coverMediaId == null || body.coverMediaId === ""
      ? null
      : typeof body.coverMediaId === "string"
        ? body.coverMediaId.trim() || null
        : null;

  if (isPublic) {
    const conflict = await findPublicAlbumNameConflict(prisma, {
      userId: user.id,
      nameTrimmed: name,
    });
    if (conflict) {
      return NextResponse.json(
        {
          error:
            "A public album with this name already exists. Choose another name, or create a personal album (not public).",
        },
        { status: 409 },
      );
    }
  }

  if (coverRaw) {
    const fileUuid = await getAdminFileUuid();
    const m = await prisma.gedcomMedia.findFirst({
      where: { id: coverRaw, fileUuid },
      select: { id: true },
    });
    if (!m) {
      return NextResponse.json(
        { error: "Cover media must be an OBJE in the current admin tree." },
        { status: 400 },
      );
    }
  }

  try {
    const maxSort = await prisma.album.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });
    const created = await prisma.album.create({
      data: {
        userId: user.id,
        name,
        description,
        isPublic,
        coverMediaId: coverRaw,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        coverMediaId: true,
        sortOrder: true,
      },
    });
    const album = await enrichAlbumWithCoverPreview(created);

    return NextResponse.json({ album }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (msg.includes("albums_user_public_lower_trim_name_unique")) {
      return NextResponse.json(
        {
          error:
            "A public album with this name already exists. Choose another name, or create a personal album (not public).",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
