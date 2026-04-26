import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  getAdminTreeCommunityUserIds,
  messageParticipantWhere,
  treeScopedMessageWhere,
} from "@/lib/admin/admin-message-tree-scope";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

  /** Always restrict to rows this user participates in (defense in depth for every tab). */
  const parts: Prisma.MessageWhereInput[] = [scope, messageParticipantWhere(user.id)];
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
  const { recipientId, recipientIds: recipientIdsRaw, conversationId: clientConversationId, subject, content } =
    body as {
      recipientId?: string;
      recipientIds?: string[];
      /** When replying in an existing multi-recipient thread, reuse this id (validated). */
      conversationId?: string;
      subject?: string;
      content: string;
    };

  const fromArray = Array.isArray(recipientIdsRaw) ? recipientIdsRaw : [];
  const fromLegacy = recipientId?.trim() ? [recipientId.trim()] : [];
  const recipientIds = [...new Set([...fromArray, ...fromLegacy].map((id) => String(id).trim()).filter(Boolean))];

  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (recipientIds.length === 0 || !trimmedContent) {
    return NextResponse.json(
      { error: "At least one recipientId and non-empty content are required" },
      { status: 400 },
    );
  }

  if (recipientIds.some((id) => id === user.id)) {
    return NextResponse.json({ error: "You cannot send a message to yourself" }, { status: 400 });
  }

  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  const notInCommunity = recipientIds.filter((id) => !communityIds.includes(id));
  if (notInCommunity.length > 0) {
    return NextResponse.json(
      { error: "One or more recipients are not part of this tree community" },
      { status: 403 },
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds }, isActive: true },
    select: { id: true },
  });
  if (users.length !== recipientIds.length) {
    return NextResponse.json({ error: "One or more recipients were not found" }, { status: 404 });
  }

  const include = {
    sender: { select: { id: true, username: true, name: true } },
    recipient: { select: { id: true, username: true, name: true } },
  } as const;

  let conversationId: string | null = null;
  if (recipientIds.length > 1) {
    const cidRaw = typeof clientConversationId === "string" ? clientConversationId.trim() : "";
    if (cidRaw) {
      if (!UUID_RE.test(cidRaw)) {
        return NextResponse.json({ error: "Invalid conversationId" }, { status: 400 });
      }
      const scope = treeScopedMessageWhere(treeId, communityIds);
      const participant = messageParticipantWhere(user.id);
      const existing = await prisma.message.findFirst({
        where: { AND: [{ conversationId: cidRaw }, scope, participant] },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "conversationId not found or you are not a participant" },
          { status: 403 },
        );
      }
      conversationId = cidRaw;
    } else {
      conversationId = randomUUID();
    }
  }

  const messages = await prisma.$transaction(
    recipientIds.map((rid) =>
      prisma.message.create({
        data: {
          senderId: user.id,
          recipientId: rid,
          conversationId,
          subject: subject ?? null,
          content: trimmedContent,
        },
        include,
      }),
    ),
  );

  emitAdminMessagesChanged();

  return NextResponse.json(
    { messages, message: messages[0] ?? null, count: messages.length },
    { status: 201 },
  );
});
