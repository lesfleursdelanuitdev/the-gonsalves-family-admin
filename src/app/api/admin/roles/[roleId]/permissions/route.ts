import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const POST = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "role", action: "update", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { roleId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const entity = typeof body.entity === "string" ? body.entity.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
  const scope = typeof body.scope === "string" ? body.scope.trim().toLowerCase() : "";

  if (!entity || !action || !scope) {
    return NextResponse.json({ error: "entity, action, and scope are required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const permission = await prisma.rolePermission.create({
    data: { roleId, entity, action, scope },
  });

  return NextResponse.json({ permission }, { status: 201 });
});

