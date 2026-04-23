import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  getAdminTreeCommunityUserIds,
  treeScopedMessageWhere,
} from "@/lib/admin/admin-message-tree-scope";
import { emitAdminMessagesChanged } from "@/lib/realtime/admin-messages-events";

export const GET = withAdminAuth(async (request, user, _ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json({ error: "ADMIN_TREE_ID is not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const filterRaw = searchParams.get("filter") ?? "all";
  const filter =
    filterRaw === "inbox" || filterRaw === "sent" || filterRaw === "all" ? filterRaw : "all";
  const { limit, offset } = parseListParams(searchParams);

  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  const scope = treeScopedMessageWhere(treeId, communityIds);

  const parts: Prisma.MessageWhereInput[] = [scope];
  if (filter === "inbox") parts.push({ recipientId: user.id });
  if (filter === "sent") parts.push({ senderId: user.id });
  if (q) {
    parts.push({
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.MessageWhereInput =
    parts.length === 1 ? parts[0]! : { AND: parts };

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, username: true, name: true } },
        recipient: { select: { id: true, username: true, name: true } },
      },
    }),
    prisma.message.count({ where }),
  ]);

  return NextResponse.json({
    messages,
    total,
    hasMore: offset + limit < total,
  });
});

export const POST = withAdminAuth(async (request, user, _ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json({ error: "ADMIN_TREE_ID is not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { recipientId, subject, content } = body as {
    recipientId: string;
    subject?: string;
    content: string;
  };

  if (!recipientId || !content) {
    return NextResponse.json(
      { error: "recipientId and content are required" },
      { status: 400 },
    );
  }

  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  if (!communityIds.includes(recipientId)) {
    return NextResponse.json(
      { error: "Recipient is not part of this tree community" },
      { status: 403 },
    );
  }

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  const message = await prisma.message.create({
    data: {
      senderId: user.id,
      recipientId,
      subject: subject ?? null,
      content,
    },
    include: {
      sender: { select: { id: true, username: true, name: true } },
      recipient: { select: { id: true, username: true, name: true } },
    },
  });

  emitAdminMessagesChanged();

  return NextResponse.json({ message }, { status: 201 });
});
