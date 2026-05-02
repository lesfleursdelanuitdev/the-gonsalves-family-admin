import { NextResponse } from "next/server";
import { Prisma, StoryKind } from "@ligneous/prisma";
import { createDefaultSectionBlocks } from "@/lib/admin/story-creator/story-block-factory";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, user) => {
  const treeId = await getAdminTreeId();
  const stories = await prisma.story.findMany({
    where: { treeId, authorId: user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, kind: true, status: true, updatedAt: true },
  });

  return NextResponse.json({
    stories: stories.map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind === StoryKind.article ? "article" : s.kind === StoryKind.post ? "post" : "story",
      status: s.status === "published" ? "published" : "draft",
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
});

export const POST = withAdminAuth(async (request, user) => {
  const treeId = await getAdminTreeId();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const titleRaw = typeof body.title === "string" ? body.title.trim() : "";
  const title = titleRaw || "Untitled story";
  const kindRaw = body.kind;
  const kind =
    kindRaw === "article"
      ? StoryKind.article
      : kindRaw === "post"
        ? StoryKind.post
        : StoryKind.story;

  const story = await prisma.story.create({
    data: {
      treeId,
      authorId: user.id,
      title,
      kind,
      status: "draft",
      tags: [],
      body: "",
      contentVersion: 1,
      isPublished: false,
    },
  });

  const ch = await prisma.storyChapter.create({
    data: { storyId: story.id, title: "Section 1", sortOrder: 0 },
  });

  await prisma.storySection.create({
    data: {
      chapterId: ch.id,
      title: "Section 1",
      sortOrder: 0,
      contentJson: { blocks: createDefaultSectionBlocks() } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ id: story.id }, { status: 201 });
});
