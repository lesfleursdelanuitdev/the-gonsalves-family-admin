import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { toRoleKey } from "@/lib/authz/roles";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "role", action: "read", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { roleId } = await ctx.params;
  const adminTreeId = process.env.ADMIN_TREE_ID ?? null;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: { orderBy: [{ entity: "asc" }, { scope: "asc" }, { action: "asc" }] },
      assignments: {
        where: adminTreeId
          ? {
              OR: [{ treeId: adminTreeId }, { treeId: null }],
            }
          : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, username: true, email: true, name: true, isActive: true } },
          tree: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  return NextResponse.json({ role });
});

export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "role", action: "update", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { roleId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.key === "string") {
    const generated = toRoleKey(body.key);
    if (!generated) return NextResponse.json({ error: "role key could not be generated" }, { status: 400 });
    patch.key = generated;
  }
  if (typeof body.description === "string") patch.description = body.description.trim() || null;
  if (typeof body.scope === "string") patch.scope = body.scope.trim().toLowerCase();

  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true, isSystem: true } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.isSystem && patch.scope != null) {
    return NextResponse.json({ error: "Cannot change scope on system role" }, { status: 400 });
  }
  if (typeof patch.name === "string" && patch.name.length > 0) {
    const duplicateName = await prisma.role.findFirst({
      where: {
        id: { not: roleId },
        name: { equals: patch.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicateName) return NextResponse.json({ error: "Role name must be unique." }, { status: 409 });
  }
  if (typeof patch.key === "string" && patch.key.length > 0) {
    const duplicateKey = await prisma.role.findFirst({
      where: {
        id: { not: roleId },
        key: patch.key,
      },
      select: { id: true },
    });
    if (duplicateKey) return NextResponse.json({ error: "Role key must be unique." }, { status: 409 });
  }

  const updated = await prisma.role.update({ where: { id: roleId }, data: patch });
  return NextResponse.json({ role: updated });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "role", action: "delete", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { roleId } = await ctx.params;

  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true, isSystem: true } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 400 });

  await prisma.role.delete({ where: { id: roleId } });
  return NextResponse.json({ ok: true });
});

