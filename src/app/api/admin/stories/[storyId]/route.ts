import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { dbRecordToStoryDocument, STORY_DB_READ_INCLUDE } from "@/lib/admin/story-creator/story-db-mapping";
import { replaceStoryFromDocumentInTx } from "@/lib/admin/story-creator/persist-story-from-document";
import type { StoryDocument } from "@/lib/admin/story-creator/story-types";

async function assertOwnedStory(storyId: string, userId: string, treeId: string) {
  return prisma.story.findFirst({
    where: { id: storyId, authorId: userId, treeId, deletedAt: null },
    select: { id: true },
  });
}

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { storyId } = await ctx.params;
  const treeId = await getAdminTreeId();
  const owned = await assertOwnedStory(storyId, user.id, treeId);
  if (!owned) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const story = await prisma.story.findFirst({
    where: { id: storyId, treeId, authorId: user.id, deletedAt: null },
    include: STORY_DB_READ_INCLUDE,
  });
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const doc = dbRecordToStoryDocument(story);
  return NextResponse.json(doc);
});

export const PUT = withAdminAuth(async (request, user, ctx) => {
  const { storyId } = await ctx.params;
  const treeId = await getAdminTreeId();
  const owned = await assertOwnedStory(storyId, user.id, treeId);
  if (!owned) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a story document object" }, { status: 400 });
  }

  const doc = body as StoryDocument;
  if (doc.id !== storyId) {
    return NextResponse.json({ error: "Document id must match URL story id" }, { status: 400 });
  }
  if (doc.version !== 1) {
    return NextResponse.json({ error: "Unsupported document version" }, { status: 400 });
  }
  if (!Array.isArray(doc.sections)) {
    return NextResponse.json({ error: "sections must be an array" }, { status: 400 });
  }

  try {
    const { updatedAt } = await prisma.$transaction(async (tx) =>
      replaceStoryFromDocumentInTx(tx, { storyId, userId: user.id, doc }),
    );
    return NextResponse.json({ updatedAt: updatedAt.toISOString() });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Document id must match")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const prismaErr = e instanceof Prisma.PrismaClientKnownRequestError ? e : null;
    console.error("PUT /api/admin/stories/[storyId] transaction failed", prismaErr?.code ?? "", prismaErr?.message ?? e);
    return NextResponse.json(
      {
        error: "Could not save story (database rejected the payload)",
        ...(prismaErr
          ? {
              code: prismaErr.code,
              ...(process.env.NODE_ENV === "development" ? { detail: prismaErr.message } : {}),
            }
          : {}),
      },
      { status: 400 },
    );
  }
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { storyId } = await ctx.params;
  const treeId = await getAdminTreeId();
  const owned = await assertOwnedStory(storyId, user.id, treeId);
  if (!owned) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  await prisma.story.update({
    where: { id: storyId },
    // Clear slug so `(treeId, slug)` unique index does not reserve it for deleted rows.
    data: { deletedAt: new Date(), slug: null },
  });

  return new NextResponse(null, { status: 204 });
});
