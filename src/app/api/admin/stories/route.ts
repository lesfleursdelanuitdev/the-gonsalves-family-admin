import { NextResponse } from "next/server";
import { Prisma, StoryKind, StoryStatus } from "@ligneous/prisma";
import { createDefaultSectionBlocks } from "@/lib/admin/story-creator/story-block-factory";
import { slugifyStoryTitle } from "@/lib/admin/story-creator/story-slug";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";

async function allocateUniqueStorySlug(treeId: string, title: string): Promise<string> {
  const base = slugifyStoryTitle(title);
  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    // `@@unique([treeId, slug])` applies to all rows; soft-deleted stories used to keep `slug`
    // and blocked new creates when we only checked `deletedAt: null`.
    const taken = await prisma.story.findFirst({
      where: { treeId, slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export const GET = withAdminAuth(async (_req, user) => {
  const treeId = await getAdminTreeId();
  const stories = await prisma.story.findMany({
    where: { treeId, authorId: user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, kind: true, status: true, slug: true, updatedAt: true },
  });

  return NextResponse.json({
    stories: stories.map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind === StoryKind.article ? "article" : s.kind === StoryKind.post ? "post" : "story",
      status: s.status === "published" ? "published" : "draft",
      slug: s.slug,
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

  const slug = await allocateUniqueStorySlug(treeId, title);

  const story = await prisma.story.create({
    data: {
      treeId,
      authorId: user.id,
      title,
      slug,
      kind,
      status: StoryStatus.draft,
      tags: [],
      body: JSON.stringify({
        v: "ligneous-story-meta/1",
        authors: [],
        author: null,
        authorPrefixMode: null,
        authorPrefixCustom: null,
      }),
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

  return NextResponse.json({ id: story.id, slug: story.slug }, { status: 201 });
});
