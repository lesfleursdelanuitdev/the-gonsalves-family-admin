import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import {
  findMessageVisibleToAdminUser,
  getAdminTreeCommunityUserIds,
} from "@/lib/admin/admin-message-tree-scope";
import { emitAdminMessagesChanged } from "@/lib/realtime/admin-messages-events";

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json({ error: "ADMIN_TREE_ID is not configured" }, { status: 500 });
  }

  const { id } = await ctx.params;
  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  const visible = await findMessageVisibleToAdminUser(id, treeId, communityIds, user.id);
  if (!visible) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const message = await prisma.message.findUnique({
    where: { id },
    include: {
      sender: { select: { id: true, username: true, name: true } },
      recipient: { select: { id: true, username: true, name: true } },
    },
  });

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ message });
});

export const PATCH = withAdminAuth(async (request, user, ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json({ error: "ADMIN_TREE_ID is not configured" }, { status: 500 });
  }

  const { id } = await ctx.params;
  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  const visible = await findMessageVisibleToAdminUser(id, treeId, communityIds, user.id);
  if (!visible) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const body = await request.json();
  const { isRead } = body as { isRead: boolean };

  if (typeof isRead !== "boolean") {
    return NextResponse.json({ error: "isRead (boolean) is required" }, { status: 400 });
  }

  const existing = await prisma.message.findUnique({
    where: { id },
    select: { recipientId: true },
  });
  if (!existing?.recipientId) {
    return NextResponse.json({ error: "Message cannot be marked read" }, { status: 400 });
  }
  // Read receipts: only the recipient may toggle read state (not the sender).
  if (existing.recipientId !== user.id) {
    return NextResponse.json({ error: "Only the recipient can update read status" }, { status: 403 });
  }

  const message = await prisma.message.update({
    where: { id },
    data: {
      isRead,
      readAt: isRead ? new Date() : null,
    },
    include: {
      sender: { select: { id: true, username: true, name: true } },
      recipient: { select: { id: true, username: true, name: true } },
    },
  });

  emitAdminMessagesChanged();

  return NextResponse.json({ message });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json({ error: "ADMIN_TREE_ID is not configured" }, { status: 500 });
  }

  const { id } = await ctx.params;
  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  const visible = await findMessageVisibleToAdminUser(id, treeId, communityIds, user.id);
  if (!visible) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  await prisma.message.delete({ where: { id } });

  emitAdminMessagesChanged();

  return NextResponse.json({ success: true });
});
