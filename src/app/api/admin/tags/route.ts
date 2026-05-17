import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { getAdminTreeReadScope } from "@/lib/infra/admin-tree-access";
import { requireCan } from "@/lib/authz/routeGuards";

/** Tags the current user may apply: global + their own. */
export const GET = withAdminAuth(async (request, user) => {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const requestedOwnerUserId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const { limit, offset } = parseListParams(request.nextUrl.searchParams);
  const { canReadAllTreeData: isAdminTreeOwner } = await getAdminTreeReadScope(user);

  let baseWhere: Record<string, unknown>;
  if (requestedOwnerUserId) {
    const isOwn = requestedOwnerUserId === user.id;
    await requireCan({
      entity: "tag",
      action: "read",
      scope: isOwn ? "user" : "other_users",
      ownerUserId: requestedOwnerUserId,
      treeId: process.env.ADMIN_TREE_ID ?? null,
    });
    baseWhere = {
      OR: [{ isGlobal: true }, { userId: requestedOwnerUserId }],
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };
  } else if (isAdminTreeOwner) {
    await requireCan({ entity: "tag", action: "read", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
    baseWhere = {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };
  } else {
    await requireCan({ entity: "tag", action: "read", scope: "user", ownerUserId: user.id, treeId: process.env.ADMIN_TREE_ID ?? null });
    baseWhere = {
      OR: [{ isGlobal: true }, { userId: user.id }],
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };
  }

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
  await requireCan({ entity: "tag", action: "create", scope: "user", ownerUserId: user.id, treeId: process.env.ADMIN_TREE_ID ?? null });
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
