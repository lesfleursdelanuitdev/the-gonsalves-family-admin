import { Prisma } from "@ligneous/prisma";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  isAllowedPermissionDefinitionAction,
  normalizePermissionAction,
  permissionDescription,
} from "@/lib/authz/permissionDefinitions";
import { requireCan } from "@/lib/authz/routeGuards";

function key(entity: string, action: string, scope: string): string {
  return `${entity}:${action}:${scope}`;
}

async function syncSystemPermissionsFromRolePermissions(): Promise<void> {
  const grouped = await prisma.rolePermission.groupBy({
    by: ["entity", "action", "scope"],
  });
  if (!grouped.length) return;

  const existing = await prisma.authzPermission.findMany({
    select: { entity: true, action: true, scope: true },
  });
  const seen = new Set(existing.map((p) => key(p.entity, p.action, p.scope)));

  for (const p of grouped) {
    const k = key(p.entity, p.action, p.scope);
    if (seen.has(k)) continue;
    await prisma.authzPermission.create({
      data: {
        entity: p.entity,
        action: p.action,
        scope: p.scope,
        description: permissionDescription(p.entity, p.action, p.scope),
        isSystem: true,
      },
    });
    seen.add(k);
  }
}

export const GET = withAdminAuth(async (req) => {
  await requireCan({ entity: "permission", action: "read", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  await syncSystemPermissionsFromRolePermissions();

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const { limit, offset } = parseListParams(req.nextUrl.searchParams);
  const where = q
    ? {
        OR: [
          { entity: { contains: q, mode: "insensitive" as const } },
          { action: { contains: q, mode: "insensitive" as const } },
          { scope: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [permissions, total, groupedUsage] = await Promise.all([
    prisma.authzPermission.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: [{ isSystem: "desc" }, { entity: "asc" }, { action: "asc" }, { scope: "asc" }],
      select: {
        id: true,
        entity: true,
        action: true,
        scope: true,
        description: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.authzPermission.count({ where }),
    prisma.rolePermission.groupBy({
      by: ["entity", "action", "scope"],
      _count: { _all: true },
    }),
  ]);

  const usage = new Map(groupedUsage.map((g) => [key(g.entity, g.action, g.scope), g._count._all]));

  return NextResponse.json({
    permissions: permissions.map((p) => ({
      ...p,
      roleUsageCount: usage.get(key(p.entity, p.action, p.scope)) ?? 0,
    })),
    total,
    hasMore: offset + limit < total,
  });
});

export const POST = withAdminAuth(async (req) => {
  await requireCan({ entity: "permission", action: "create", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const entity = typeof body.entity === "string" ? body.entity.trim() : "";
  const action = typeof body.action === "string" ? normalizePermissionAction(body.action) : "";
  const scope = typeof body.scope === "string" ? body.scope.trim().toLowerCase() : "tree";
  const descriptionInput = typeof body.description === "string" ? body.description.trim() : "";

  if (!entity) return NextResponse.json({ error: "entity is required" }, { status: 400 });
  if (!scope) return NextResponse.json({ error: "scope is required" }, { status: 400 });
  if (!isAllowedPermissionDefinitionAction(action) || action === "manage") {
    return NextResponse.json({ error: "action must be one of read, create, edit, delete" }, { status: 400 });
  }

  try {
    const permission = await prisma.authzPermission.create({
      data: {
        entity,
        action,
        scope,
        description: descriptionInput || permissionDescription(entity, action, scope),
        isSystem: false,
      },
    });
    return NextResponse.json({ permission }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Permission already exists for this entity/action/scope." }, { status: 409 });
    }
    throw error;
  }
});
