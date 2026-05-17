import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { createIndividualRelationship, listRelationshipsForIndividual } from "@/lib/admin/individual-relationships-service";

export const GET = withAdminAuth(async (req) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const individualId = req.nextUrl.searchParams.get("individualId")?.trim() ?? "";
  if (!individualId) return NextResponse.json({ error: "individualId is required" }, { status: 400 });
  const relationships = await listRelationshipsForIndividual(individualId);
  return NextResponse.json({ relationships });
});

export const POST = withAdminAuth(async (req) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const relationshipTypeId = typeof body.relationshipTypeId === "string" ? body.relationshipTypeId.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes : null;
  const participants = Array.isArray(body.participants) ? body.participants : [];
  if (!relationshipTypeId) return NextResponse.json({ error: "relationshipTypeId is required" }, { status: 400 });
  if (participants.length < 2) return NextResponse.json({ error: "At least two participants are required" }, { status: 400 });

  const relationshipType = await prisma.relationshipType.findFirst({
    where: { id: relationshipTypeId },
    select: { id: true },
  });
  if (!relationshipType) return NextResponse.json({ error: "Relationship type not found" }, { status: 404 });

  try {
    const relationship = await createIndividualRelationship({
      fileUuid,
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
    return NextResponse.json({ relationship }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
});
