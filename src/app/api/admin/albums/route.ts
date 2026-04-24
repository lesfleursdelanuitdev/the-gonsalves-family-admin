import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";

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
      select: { id: true, name: true, description: true },
      orderBy: { sortOrder: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.album.count({ where: baseWhere }),
  ]);

  return NextResponse.json({
    albums,
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

  const album = await prisma.album.create({
    data: {
      userId: user.id,
      name,
      description,
    },
    select: { id: true, name: true, description: true },
  });

  return NextResponse.json({ album }, { status: 201 });
});
