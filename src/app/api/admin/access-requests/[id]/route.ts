import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import type { AccessRequestStatus } from "@ligneous/prisma";

const VALID_STATUSES: AccessRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];

const DETAIL_SELECT = {
  id: true,
  requestType: true,
  resourceType: true,
  resourceId: true,
  requestedPermissionType: true,
  status: true,
  notes: true,
  responseNotes: true,
  requestedAt: true,
  respondedAt: true,
  respondedBy: true,
  user: { select: { id: true, name: true, username: true, email: true, createdAt: true } },
  responder: { select: { id: true, name: true, username: true } },
} as const;

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "user", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;

  const request = await prisma.accessRequest.findFirst({
    where: { id, treeId },
    select: DETAIL_SELECT,
  });

  if (!request) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  return NextResponse.json({ request });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  await requireCan({ entity: "user", action: "update", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.accessRequest.findFirst({ where: { id, treeId } });
  if (!existing) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "set_status") {
    const newStatus = body.status as AccessRequestStatus;
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const responseNotes = typeof body.responseNotes === "string" ? body.responseNotes.trim() || null : existing.responseNotes;
    await prisma.accessRequest.update({
      where: { id },
      data: {
        status: newStatus,
        respondedAt: new Date(),
        respondedBy: user.id,
        ...(responseNotes !== undefined ? { responseNotes } : {}),
      },
    });
    const request = await prisma.accessRequest.findFirstOrThrow({ where: { id }, select: DETAIL_SELECT });
    return NextResponse.json({ request });
  }

  if (action === "set_response_notes") {
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    await prisma.accessRequest.update({
      where: { id },
      data: { responseNotes: notes, respondedAt: new Date(), respondedBy: user.id },
    });
    const request = await prisma.accessRequest.findFirstOrThrow({ where: { id }, select: DETAIL_SELECT });
    return NextResponse.json({ request });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "user", action: "delete", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;

  const existing = await prisma.accessRequest.findFirst({ where: { id, treeId } });
  if (!existing) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  await prisma.accessRequest.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
});
