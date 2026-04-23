import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

function parseLimit(searchParams: URLSearchParams): number {
  const n = parseInt(searchParams.get("limit") ?? "30", 10);
  if (Number.isNaN(n)) return 30;
  return Math.min(100, Math.max(1, n));
}

/** Tags the current user may apply: global + their own. */
export const GET = withAdminAuth(async (request, user) => {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(request.nextUrl.searchParams);

  const tags = await prisma.tag.findMany({
    where: {
      OR: [{ isGlobal: true }, { userId: user.id }],
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: { id: true, name: true, color: true, isGlobal: true, userId: true },
    orderBy: [{ isGlobal: "desc" }, { name: "asc" }],
    take: limit,
  });

  return NextResponse.json({ tags });
});

export const POST = withAdminAuth(async (request, user) => {
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim().slice(0, 7) : null;

  const dup = await prisma.tag.findFirst({
    where: { userId: user.id, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "You already have a tag with this name" }, { status: 409 });
  }

  const tag = await prisma.tag.create({
    data: {
      userId: user.id,
      name,
      color,
      isGlobal: false,
      createdBy: user.id,
    },
    select: { id: true, name: true, color: true, isGlobal: true, userId: true },
  });

  return NextResponse.json({ tag }, { status: 201 });
});
