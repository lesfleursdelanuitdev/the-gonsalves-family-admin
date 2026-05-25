import { NextRequest, NextResponse } from "next/server";
import { StoryStatus } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeReadScope } from "@/lib/infra/admin-tree-access";

export const GET = withAdminAuth(async (_req, _user) => {
  const posts = await prisma.whatsNew.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, username: true } },
    },
  });
  return NextResponse.json({ posts });
});

export const POST = withAdminAuth(async (req: NextRequest, user) => {
  const { canReadAllTreeData } = await getAdminTreeReadScope(user);
  if (!canReadAllTreeData) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string; body?: unknown };
  const title = (body.title ?? "").trim() || "Untitled update";

  const post = await prisma.whatsNew.create({
    data: {
      title,
      body: (body.body as object) ?? {},
      status: StoryStatus.draft,
      authorId: user.id,
    },
    select: { id: true, title: true, status: true, createdAt: true },
  });

  return NextResponse.json({ post }, { status: 201 });
});
