import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import type { PublicIntakeStatus } from "@ligneous/prisma";

const VALID_STATUSES: PublicIntakeStatus[] = ["pending", "reviewed", "approved", "rejected", "archived", "spam"];

const DETAIL_SELECT = {
  id: true,
  contributorFirstName: true,
  contributorLastName: true,
  contributorEmail: true,
  type: true,
  content: true,
  status: true,
  relatedIndividualXref: true,
  relatedFamilyXref: true,
  relatedPlace: true,
  relatedDate: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
  reviewer: { select: { id: true, name: true, username: true } },
  individuals: {
    select: {
      id: true,
      individualXref: true,
      individualNameSnapshot: true,
      birthDateSnapshot: true,
      sortOrder: true,
      individual: { select: { id: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  attachments: {
    select: {
      id: true,
      kind: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      caption: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "user", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;

  const contribution = await prisma.contribution.findFirst({
    where: { id, treeId },
    select: DETAIL_SELECT,
  });

  if (!contribution) {
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
  }

  return NextResponse.json({ contribution });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  await requireCan({ entity: "user", action: "update", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.contribution.findFirst({ where: { id, treeId } });
  if (!existing) {
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "set_status") {
    const newStatus = body.status as PublicIntakeStatus;
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await prisma.contribution.update({
      where: { id },
      data: { status: newStatus, reviewedAt: new Date(), reviewedBy: user.id },
    });
    const contribution = await prisma.contribution.findFirstOrThrow({ where: { id }, select: DETAIL_SELECT });
    return NextResponse.json({ contribution });
  }

  if (action === "set_notes") {
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    await prisma.contribution.update({
      where: { id },
      data: { reviewNotes: notes || null, reviewedAt: new Date(), reviewedBy: user.id },
    });
    const contribution = await prisma.contribution.findFirstOrThrow({ where: { id }, select: DETAIL_SELECT });
    return NextResponse.json({ contribution });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "user", action: "delete", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;

  const existing = await prisma.contribution.findFirst({ where: { id, treeId } });
  if (!existing) {
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
  }

  await prisma.contribution.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
});
