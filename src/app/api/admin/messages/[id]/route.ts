import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;

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

export const PATCH = withAdminAuth(async (request, _user, ctx) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const { isRead } = body as { isRead: boolean };

  if (typeof isRead !== "boolean") {
    return NextResponse.json({ error: "isRead (boolean) is required" }, { status: 400 });
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

  return NextResponse.json({ message });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;

  const existing = await prisma.message.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  await prisma.message.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
