import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "event", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const attributeType = await prisma.attributeType.findUnique({ where: { id } });
  if (!attributeType) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ attributeType });
});

export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "event", action: "update", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const row = await prisma.attributeType.findUnique({ where: { id }, select: { isCustom: true, fileUuid: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!row.isCustom || row.fileUuid !== fileUuid) {
    return NextResponse.json({ error: "Standard attribute types cannot be modified." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (body.ownerScope === "FAM" || body.ownerScope === "BOTH" || body.ownerScope === "INDI") {
    data.ownerScope = body.ownerScope;
  }
  if (typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)) data.color = body.color;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.trunc(body.sortOrder);
  }

  const attributeType = await prisma.attributeType.update({ where: { id }, data });
  return NextResponse.json({ attributeType });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "event", action: "delete", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const row = await prisma.attributeType.findUnique({ where: { id }, select: { isCustom: true, fileUuid: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!row.isCustom || row.fileUuid !== fileUuid) {
    return NextResponse.json({ error: "Standard attribute types cannot be deleted." }, { status: 403 });
  }

  await prisma.attributeType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
