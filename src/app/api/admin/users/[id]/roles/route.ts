import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const POST = withAdminAuth(async (req, actor, ctx) => {
  await requireCan({ entity: "user", action: "update", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const roleId = typeof body.roleId === "string" ? body.roleId.trim() : "";
  const treeIdRaw = typeof body.treeId === "string" ? body.treeId.trim() : "";
  const treeId = treeIdRaw || null;

  if (!roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 });

  const [user, role] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true } }),
    prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }),
  ]);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  if (treeId) {
    const tree = await prisma.tree.findUnique({ where: { id: treeId }, select: { id: true } });
    if (!tree) return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }

  const assignment = await prisma.userRole.create({
    data: {
      userId: id,
      roleId,
      treeId,
      createdBy: actor.id,
    },
    include: {
      role: { select: { id: true, key: true, name: true, scope: true } },
      user: { select: { id: true, username: true, email: true } },
      tree: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ userRole: assignment }, { status: 201 });
});

