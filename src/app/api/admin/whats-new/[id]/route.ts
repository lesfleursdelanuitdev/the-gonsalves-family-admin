import { NextRequest, NextResponse } from "next/server";
import { StoryStatus } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeReadScope } from "@/lib/infra/admin-tree-access";

export const GET = withAdminAuth(async (_req: NextRequest, _user, ctx) => {
  const { id } = await ctx.params;
  const post = await prisma.whatsNew.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true, username: true } } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
});

export const PUT = withAdminAuth(async (req: NextRequest, user, ctx) => {
  const { canReadAllTreeData } = await getAdminTreeReadScope(user);
  if (!canReadAllTreeData) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.whatsNew.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: unknown;
    status?: string;
  };

  const status =
    body.status === "published"
      ? StoryStatus.published
      : body.status === "archived"
        ? StoryStatus.archived
        : body.status === "draft"
          ? StoryStatus.draft
          : undefined;

  const publishedAt =
    status === StoryStatus.published
      ? (await prisma.whatsNew.findUnique({ where: { id }, select: { publishedAt: true } }))
          ?.publishedAt ?? new Date()
      : status === StoryStatus.draft || status === StoryStatus.archived
        ? null
        : undefined;

  const post = await prisma.whatsNew.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() || "Untitled update" } : {}),
      ...(body.body !== undefined ? { body: body.body as object } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
    },
    include: { author: { select: { id: true, name: true, username: true } } },
  });

  return NextResponse.json({ post });
});

export const DELETE = withAdminAuth(async (_req: NextRequest, user, ctx) => {
  const { canReadAllTreeData } = await getAdminTreeReadScope(user);
  if (!canReadAllTreeData) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.whatsNew.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.whatsNew.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
