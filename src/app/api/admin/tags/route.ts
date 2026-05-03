import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";

/** Tags the current user may apply: global + their own. */
export const GET = withAdminAuth(async (request, user) => {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const { limit, offset } = parseListParams(request.nextUrl.searchParams);

  const baseWhere = {
    OR: [{ isGlobal: true }, { userId: user.id }],
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where: baseWhere,
      select: { id: true, name: true, color: true, isGlobal: true, userId: true },
      orderBy: [{ isGlobal: "desc" }, { name: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.tag.count({ where: baseWhere }),
  ]);

  return NextResponse.json({
    tags,
    total,
    hasMore: offset + tags.length < total,
  });
});

export const POST = withAdminAuth(async (request, user) => {
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim().slice(0, 7) : null;
  const description =
    typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;

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
      description,
      isGlobal: false,
      createdBy: user.id,
    },
    select: { id: true, name: true, color: true, description: true, isGlobal: true, userId: true },
  });

  return NextResponse.json({ tag }, { status: 201 });
});
