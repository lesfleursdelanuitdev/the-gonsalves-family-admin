import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "permission", action: "delete", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { permissionId } = await ctx.params;

  const permission = await prisma.authzPermission.findUnique({
    where: { id: permissionId },
    select: { id: true, entity: true, action: true, scope: true, isSystem: true },
  });
  if (!permission) return NextResponse.json({ error: "Permission not found" }, { status: 404 });
  if (permission.isSystem) {
    return NextResponse.json({ error: "System permissions for existing entities cannot be deleted." }, { status: 400 });
  }

  const inUse = await prisma.rolePermission.count({
    where: {
      entity: permission.entity,
      action: permission.action,
      scope: permission.scope,
    },
  });
  if (inUse > 0) {
    return NextResponse.json({ error: "Permission is assigned to roles and cannot be deleted." }, { status: 400 });
  }

  await prisma.authzPermission.delete({ where: { id: permissionId } });
  return NextResponse.json({ ok: true });
});
