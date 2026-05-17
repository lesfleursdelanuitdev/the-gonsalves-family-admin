import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { requireCan } from "@/lib/authz/routeGuards";
import { toRoleKey } from "@/lib/authz/roles";

export const GET = withAdminAuth(async (req) => {
  await requireCan({ entity: "role", action: "read", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const { limit, offset } = parseListParams(req.nextUrl.searchParams);

  const where = q
    ? {
        OR: [
          { key: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { permissions: true, assignments: true } },
      },
    }),
    prisma.role.count({ where }),
  ]);

  return NextResponse.json({
    roles: roles.map((r) => ({
      ...r,
      permissionCount: r._count.permissions,
      assignmentCount: r._count.assignments,
    })),
    total,
    hasMore: offset + limit < total,
  });
});

export const POST = withAdminAuth(async (req) => {
  await requireCan({ entity: "role", action: "create", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const keyRaw = typeof body.key === "string" ? body.key.trim() : "";
  const scopeRaw = typeof body.scope === "string" ? body.scope.trim().toLowerCase() : "site";
  const description = typeof body.description === "string" ? body.description.trim() : null;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!scopeRaw) return NextResponse.json({ error: "scope is required" }, { status: 400 });

  const key = toRoleKey(keyRaw || name);
  if (!key) return NextResponse.json({ error: "role key could not be generated" }, { status: 400 });

  const duplicateName = await prisma.role.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicateName) return NextResponse.json({ error: "Role name must be unique." }, { status: 409 });

  const duplicateKey = await prisma.role.findUnique({ where: { key }, select: { id: true } });
  if (duplicateKey) return NextResponse.json({ error: "Role key must be unique." }, { status: 409 });

  const created = await prisma.role.create({
    data: {
      key,
      name,
      description: description || null,
      scope: scopeRaw,
      isSystem: false,
    },
  });

  return NextResponse.json({ role: created }, { status: 201 });
});

