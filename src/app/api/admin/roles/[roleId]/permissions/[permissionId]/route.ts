import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "role", action: "update", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { roleId, permissionId } = await ctx.params;

  const row = await prisma.rolePermission.findUnique({
    where: { id: permissionId },
    select: { id: true, roleId: true },
  });
  if (!row || row.roleId !== roleId) {
    return NextResponse.json({ error: "Permission not found" }, { status: 404 });
  }

  await prisma.rolePermission.delete({ where: { id: permissionId } });
  return NextResponse.json({ ok: true });
});

