import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { updateIndividualRelationship } from "@/lib/admin/individual-relationships-service";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const relationship = await prisma.individualRelationship.findUnique({
    where: { id },
    include: {
      relationshipType: { include: { roles: true } },
      participants: { include: { individual: true, role: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!relationship) return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  return NextResponse.json({ relationship });
});

export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const relationshipTypeId = typeof body.relationshipTypeId === "string" ? body.relationshipTypeId.trim() : "";
  const participants = Array.isArray(body.participants) ? body.participants : [];
  const notes = typeof body.notes === "string" ? body.notes : null;
  if (!relationshipTypeId) return NextResponse.json({ error: "relationshipTypeId is required" }, { status: 400 });
  try {
    const relationship = await updateIndividualRelationship(id, {
      relationshipTypeId,
      notes,
      participants: participants
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p) => ({
          individualId: typeof p.individualId === "string" ? p.individualId : "",
          roleId: typeof p.roleId === "string" ? p.roleId : "",
          sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : undefined,
        })),
    });
    return NextResponse.json({ relationship });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "delete", scope: "tree" });
  const { id } = await ctx.params;
  const existing = await prisma.individualRelationship.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  await prisma.individualRelationship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
