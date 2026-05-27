import { NextResponse } from "next/server";
import { Prisma, StoryKind, StoryStatus } from "@ligneous/prisma";
import { createDefaultSectionBlocks } from "@/lib/admin/story-creator/story-block-factory";
import { slugifyStoryTitle } from "@/lib/admin/story-creator/story-slug";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { getAdminTreeReadScope } from "@/lib/infra/admin-tree-access";
import { can } from "@/lib/authz/authorize";
import { requireCan } from "@/lib/authz/routeGuards";

function prismaStoryKindToApi(kind: StoryKind): "story" | "article" | "post" | "folklore" {
  if (kind === StoryKind.article) return "article";
  if (kind === StoryKind.post) return "post";
  if (kind === StoryKind.folklore) return "folklore";
  return "story";
}

function requestKindToPrisma(kindRaw: unknown): StoryKind {
  if (kindRaw === "article") return StoryKind.article;
  if (kindRaw === "post") return StoryKind.post;
  if (kindRaw === "folklore") return StoryKind.folklore;
  return StoryKind.story;
}

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
  const { treeId, canReadAllTreeData } = await getAdminTreeReadScope(user);
  const [canReadTree, canReadOwn, canReadOthers] = await Promise.all([
    can({ userId: user.id, entity: "story", action: "read", scope: "tree", treeId }),
    can({ userId: user.id, entity: "story", action: "read", scope: "user", ownerUserId: user.id, treeId }),
    can({ userId: user.id, entity: "story", action: "read", scope: "other_users", ownerUserId: "__other_user__", treeId }),
  ]);
  const where = canReadTree && canReadAllTreeData
    ? { treeId, deletedAt: null as Date | null }
    : {
        OR: [
          ...(canReadOwn ? [{ treeId, authorId: user.id, deletedAt: null as Date | null }] : []),
          ...(canReadOthers
            ? [{ treeId, authorId: { not: user.id }, status: StoryStatus.published, deletedAt: null as Date | null }]
            : []),
        ],
      };
  if (!canReadTree && !canReadOwn && !canReadOthers) {
    await requireCan({ entity: "story", action: "read", scope: "tree", treeId });
  }
  const stories = await prisma.story.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      slug: true,
      updatedAt: true,
      authorId: true,
      tags: true,
      storyIndividuals: {
        select: { individual: { select: { id: true, fullName: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({
    stories: stories.map((s) => ({
      id: s.id,
      title: s.title,
      kind: prismaStoryKindToApi(s.kind),
      status: s.status === "published" ? "published" : "draft",
      slug: s.slug,
      updatedAt: s.updatedAt.toISOString(),
      authorId: s.authorId,
      tags: s.tags,
      linkedIndividuals: s.storyIndividuals.map((si) => ({
        id: si.individual.id,
        fullName: si.individual.fullName ?? "",
      })),
    })),
  });
});

export const POST = withAdminAuth(async (request, user) => {
  await requireCan({ entity: "story", action: "create", scope: "user", ownerUserId: user.id, treeId: process.env.ADMIN_TREE_ID ?? null });
  const treeId = await getAdminTreeId();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const titleRaw = typeof body.title === "string" ? body.title.trim() : "";
  const title = titleRaw || "Untitled story";
  const kind = requestKindToPrisma(body.kind);

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
