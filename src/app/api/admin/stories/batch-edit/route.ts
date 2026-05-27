import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

export const POST = withAdminAuth(async (request, user) => {
  await requireCan({
    entity: "story",
    action: "update",
    scope: "user",
    ownerUserId: user.id,
    treeId: process.env.ADMIN_TREE_ID ?? null,
  });

  const treeId = await getAdminTreeId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const storyIds = parseStringArray(b.storyIds);
  const tagNames = parseStringArray(b.tagNames).map((t) => t.slice(0, 100));
  const individualIds = parseStringArray(b.individualIds);
  const eventIds = parseStringArray(b.eventIds);
  const noteIds = parseStringArray(b.noteIds);

  if (storyIds.length === 0) {
    return NextResponse.json({ error: "storyIds must be a non-empty array" }, { status: 400 });
  }
  if (tagNames.length === 0 && individualIds.length === 0 && eventIds.length === 0 && noteIds.length === 0) {
    return NextResponse.json({ error: "Provide at least one of: tagNames, individualIds, eventIds, noteIds" }, { status: 400 });
  }

  // Verify all stories belong to this user's tree and are not deleted.
  const ownedStories = await prisma.story.findMany({
    where: { id: { in: storyIds }, treeId, deletedAt: null },
    select: { id: true },
  });
  const ownedIds = ownedStories.map((s) => s.id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ error: "No accessible stories found for the given ids" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    // Tags: append unique tag names to each story's string[] field.
    if (tagNames.length > 0) {
      const current = await tx.story.findMany({
        where: { id: { in: ownedIds } },
        select: { id: true, tags: true },
      });
      for (const story of current) {
        const merged = [...new Set([...story.tags, ...tagNames])];
        await tx.story.update({ where: { id: story.id }, data: { tags: merged } });
      }
    }

    // Individuals: add junction rows, skip existing.
    if (individualIds.length > 0) {
      const rows = ownedIds.flatMap((storyId) =>
        individualIds.map((individualId, sortOrder) => ({ storyId, individualId, sortOrder })),
      );
      await tx.storyIndividual.createMany({ data: rows, skipDuplicates: true });
    }

    // Events: add junction rows, skip existing.
    if (eventIds.length > 0) {
      const rows = ownedIds.flatMap((storyId) =>
        eventIds.map((eventId, sortOrder) => ({ storyId, eventId, sortOrder })),
      );
      await tx.storyEvent.createMany({ data: rows, skipDuplicates: true });
    }

    // Notes: add GEDCOM note link rows, skip existing.
    if (noteIds.length > 0) {
      const rows = ownedIds.flatMap((storyId) =>
        noteIds.map((noteId, sortOrder) => ({ storyId, noteId, sortOrder })),
      );
      await tx.storyGedcomNoteLink.createMany({ data: rows, skipDuplicates: true });
    }
  });

  return NextResponse.json({ updated: ownedIds.length });
});
