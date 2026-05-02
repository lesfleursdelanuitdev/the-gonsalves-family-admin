import type { Prisma } from "@ligneous/prisma";
import type { StoryDocument } from "@/lib/admin/story-creator/story-types";
import { storyDocumentToDbPayload } from "@/lib/admin/story-creator/story-db-mapping";

async function resolveTagIds(
  tx: Prisma.TransactionClient,
  userId: string,
  names: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 100);
    if (!name) continue;
    const existing = await tx.tag.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        OR: [{ isGlobal: true }, { userId }],
      },
      select: { id: true },
    });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const created = await tx.tag.create({
      data: {
        userId,
        name,
        isGlobal: false,
        createdBy: userId,
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return ids;
}

/**
 * Within an interactive transaction: replace story metadata, chapter/section tree, and junction rows
 * from a full `StoryDocument` (see `storyDocumentToDbPayload`).
 */
export async function replaceStoryFromDocumentInTx(
  tx: Prisma.TransactionClient,
  params: { storyId: string; userId: string; doc: StoryDocument },
): Promise<{ updatedAt: Date }> {
  const { storyId, userId, doc } = params;
  if (doc.id !== storyId) {
    throw new Error("Document id must match story route id");
  }

  const payload = storyDocumentToDbPayload(doc, "", userId);

  await tx.story.update({
    where: { id: storyId },
    data: {
      title: payload.story.title,
      excerpt: payload.story.excerpt,
      kind: payload.story.kind,
      status: payload.story.status,
      isPublished: payload.story.isPublished,
      tags: payload.story.tags,
      coverMediaId: payload.story.coverMediaId,
      coverMediaKind: payload.story.coverMediaKind,
      profileMediaId: payload.story.profileMediaId,
      profileMediaKind: payload.story.profileMediaKind,
      contentVersion: payload.story.contentVersion,
      slug: payload.story.slug,
      body: payload.story.body,
    },
  });

  await tx.storyChapter.deleteMany({ where: { storyId } });

  for (const ch of payload.chapters) {
    const createdCh = await tx.storyChapter.create({
      data: {
        storyId,
        title: ch.title,
        sortOrder: ch.sortOrder,
        slug: ch.slug,
      },
    });
    for (const sec of ch.sections) {
      await tx.storySection.create({
        data: {
          chapterId: createdCh.id,
          title: sec.title,
          sortOrder: sec.sortOrder,
          slug: sec.slug,
          isChapter: sec.isChapter,
          contentJson: sec.contentJson as Prisma.InputJsonValue,
        },
      });
    }
  }

  await tx.storyIndividual.deleteMany({ where: { storyId } });
  await tx.storyFamily.deleteMany({ where: { storyId } });
  await tx.storyEvent.deleteMany({ where: { storyId } });
  await tx.storyPlace.deleteMany({ where: { storyId } });
  await tx.storyTag.deleteMany({ where: { storyId } });
  await tx.albumStory.deleteMany({ where: { storyId } });

  const { individualIds, familyIds, eventIds, placeIds, albumIds, tagNames } = payload.junctions;

  if (individualIds.length > 0) {
    await tx.storyIndividual.createMany({
      data: individualIds.map((individualId, sortOrder) => ({
        storyId,
        individualId,
        sortOrder,
      })),
    });
  }
  if (familyIds.length > 0) {
    await tx.storyFamily.createMany({
      data: familyIds.map((familyId, sortOrder) => ({
        storyId,
        familyId,
        sortOrder,
      })),
    });
  }
  if (eventIds.length > 0) {
    await tx.storyEvent.createMany({
      data: eventIds.map((eventId, sortOrder) => ({
        storyId,
        eventId,
        sortOrder,
      })),
    });
  }
  if (placeIds.length > 0) {
    await tx.storyPlace.createMany({
      data: placeIds.map((placeId, sortOrder) => ({
        storyId,
        placeId,
        sortOrder,
      })),
    });
  }

  const tagIds = [...new Set(await resolveTagIds(tx, userId, tagNames))];
  if (tagIds.length > 0) {
    await tx.storyTag.createMany({
      data: tagIds.map((tagId) => ({
        storyId,
        tagId,
        taggedBy: userId,
      })),
    });
  }

  if (albumIds.length > 0) {
    await tx.albumStory.createMany({
      data: albumIds.map((albumId, sortOrder) => ({
        storyId,
        albumId,
        sortOrder,
        addedBy: userId,
      })),
    });
  }

  const row = await tx.story.findUniqueOrThrow({
    where: { id: storyId },
    select: { updatedAt: true },
  });
  return { updatedAt: row.updatedAt };
}
