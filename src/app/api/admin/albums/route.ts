import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

function parseLimit(searchParams: URLSearchParams): number {
  const n = parseInt(searchParams.get("limit") ?? "30", 10);
  if (Number.isNaN(n)) return 30;
  return Math.min(100, Math.max(1, n));
}

/** Albums owned by the current user (for linking Gedcom media). */
export const GET = withAdminAuth(async (request, user) => {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(request.nextUrl.searchParams);

  const albums = await prisma.album.findMany({
    where: {
      userId: user.id,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: { id: true, name: true, description: true },
    orderBy: { sortOrder: "asc" },
    take: limit,
  });

  return NextResponse.json({ albums });
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
