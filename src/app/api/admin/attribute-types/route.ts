import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

export const GET = withAdminAuth(async () => {
  await requireCan({ entity: "event", action: "read", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const attributeTypes = await prisma.attributeType.findMany({
    where: { OR: [{ fileUuid: null }, { fileUuid }] },
    orderBy: [{ isCustom: "asc" }, { sortOrder: "asc" }, { tag: "asc" }],
  });
  return NextResponse.json({ attributeTypes });
});

export const POST = withAdminAuth(async (req) => {
  await requireCan({ entity: "event", action: "update", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const tag = typeof body.tag === "string" ? body.tag.trim().toUpperCase() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const ownerScope =
    body.ownerScope === "FAM" ? "FAM" : body.ownerScope === "BOTH" ? "BOTH" : "INDI";
  const color =
    typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)
      ? body.color
      : "#6B7280";
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.trunc(body.sortOrder)
      : 0;

  if (!tag) return NextResponse.json({ error: "tag is required" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });

  const existing = await prisma.attributeType.findUnique({
    where: { tag_fileUuid: { tag, fileUuid } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A custom attribute type with tag "${tag}" already exists for this tree.` },
      { status: 409 },
    );
  }

  const attributeType = await prisma.attributeType.create({
    data: { tag, label, ownerScope, isCustom: true, sortOrder, fileUuid, color },
  });
  return NextResponse.json({ attributeType }, { status: 201 });
});
