import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = await getAdminTreeId();
  const relationshipType = await prisma.relationshipType.findFirst({
    where: { id, OR: [{ treeId }, { treeId: null }] },
    include: { roles: { orderBy: { key: "asc" } } },
  });
  if (!relationshipType) return NextResponse.json({ error: "Relationship type not found" }, { status: 404 });
  return NextResponse.json({ relationshipType });
});

export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = await getAdminTreeId();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const existing = await prisma.relationshipType.findFirst({
    where: { id, OR: [{ treeId }, { treeId: null }] },
    include: { roles: true },
  });
  if (!existing) return NextResponse.json({ error: "Relationship type not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string") patch.label = body.label.trim();
  if (typeof body.description === "string" || body.description === null) patch.description = body.description;
  if (typeof body.isSymmetric === "boolean") patch.isSymmetric = body.isSymmetric;
  if (typeof body.gedcomRelaAtoB === "string" || body.gedcomRelaAtoB === null) patch.gedcomRelaAtoB = body.gedcomRelaAtoB;
  if (typeof body.gedcomRelaBtoA === "string" || body.gedcomRelaBtoA === null) patch.gedcomRelaBtoA = body.gedcomRelaBtoA;

  const relationshipType = await prisma.relationshipType.update({
    where: { id: existing.id },
    data: patch,
    include: { roles: { orderBy: { key: "asc" } } },
  });
  return NextResponse.json({ relationshipType });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "delete", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = await getAdminTreeId();
  const existing = await prisma.relationshipType.findFirst({
    where: { id, OR: [{ treeId }, { treeId: null }] },
    select: { id: true, key: true, treeId: true },
  });
  if (!existing) return NextResponse.json({ error: "Relationship type not found" }, { status: 404 });
  if (existing.key === "custom_association") {
    return NextResponse.json({ error: "custom_association cannot be deleted." }, { status: 400 });
  }
  await prisma.relationshipType.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
});
