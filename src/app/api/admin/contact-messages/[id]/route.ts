import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { sendContactReply } from "@/lib/email/resend";
import type { PublicIntakeStatus } from "@ligneous/prisma";

const VALID_STATUSES: PublicIntakeStatus[] = [
  "pending", "reviewed", "approved", "rejected", "archived", "spam",
];

const DETAIL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  subject: true,
  message: true,
  status: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewNotes: true,
  ipAddress: true,
  createdAt: true,
  updatedAt: true,
  reviewer: { select: { id: true, name: true, username: true } },
  replies: {
    select: {
      id: true,
      subject: true,
      body: true,
      sentAt: true,
      repliedBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: { sentAt: "asc" as const },
  },
} as const;

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "user", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;

  const message = await prisma.contactMessage.findFirst({
    where: { id, treeId },
    select: DETAIL_SELECT,
  });

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ message });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  await requireCan({ entity: "user", action: "update", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.contactMessage.findFirst({ where: { id, treeId } });
  if (!existing) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "set_status") {
    const newStatus = body.status as PublicIntakeStatus;
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await prisma.contactMessage.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: user.id,
      },
    });
    const message = await prisma.contactMessage.findFirstOrThrow({
      where: { id },
      select: DETAIL_SELECT,
    });
    return NextResponse.json({ message });
  }

  if (action === "reply") {
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const replyBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!subject || !replyBody) {
      return NextResponse.json({ error: "subject and body are required" }, { status: 400 });
    }

    await sendContactReply({ to: existing.email, subject, body: replyBody });

    await prisma.$transaction([
      prisma.contactMessageReply.create({
        data: {
          contactMessageId: id,
          repliedById: user.id,
          subject,
          body: replyBody,
        },
      }),
      prisma.contactMessage.update({
        where: { id },
        data: { status: "reviewed", reviewedAt: new Date(), reviewedBy: user.id },
      }),
    ]);

    const message = await prisma.contactMessage.findFirstOrThrow({
      where: { id },
      select: DETAIL_SELECT,
    });
    return NextResponse.json({ message });
  }

  if (action === "set_notes") {
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    await prisma.contactMessage.update({
      where: { id },
      data: { reviewNotes: notes || null, reviewedAt: new Date(), reviewedBy: user.id },
    });
    const message = await prisma.contactMessage.findFirstOrThrow({
      where: { id },
      select: DETAIL_SELECT,
    });
    return NextResponse.json({ message });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "user", action: "delete", scope: "tree" });
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;

  const existing = await prisma.contactMessage.findFirst({ where: { id, treeId } });
  if (!existing) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  await prisma.contactMessage.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
});
