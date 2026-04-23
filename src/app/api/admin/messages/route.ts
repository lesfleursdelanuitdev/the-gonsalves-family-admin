import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";

export const GET = withAdminAuth(async (request, user, _ctx) => {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? "";
  const filter = searchParams.get("filter") ?? "all";
  const { limit, offset } = parseListParams(searchParams);

  const where: Record<string, unknown> = {};

  if (filter === "inbox") {
    where.recipientId = user.id;
  } else if (filter === "sent") {
    where.senderId = user.id;
  }

  if (q) {
    where.subject = { contains: q, mode: "insensitive" };
  }

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

  return NextResponse.json({ message }, { status: 201 });
});
