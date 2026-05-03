import { NextResponse } from "next/server";
import { EntityType } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const MAX_ENTITY_IDS = 2_000;
const MAX_TAG_IDS = 80;

const BATCH_ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
  EntityType.individual,
  EntityType.family,
  EntityType.event,
  EntityType.note,
  EntityType.source,
  EntityType.place,
  EntityType.date,
]);

function parseEntityType(raw: unknown): EntityType | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim() as EntityType;
  if (!v) return null;
  if (!BATCH_ENTITY_TYPES.has(v)) return null;
  return v;
}

async function filterEntityIdsInFile(
  fileUuid: string,
  entityType: EntityType,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  switch (entityType) {
    case EntityType.individual: {
      const rows = await prisma.gedcomIndividual.findMany({
        where: { fileUuid, id: { in: unique } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case EntityType.family: {
      const rows = await prisma.gedcomFamily.findMany({
        where: { fileUuid, id: { in: unique } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case EntityType.event: {
      const rows = await prisma.gedcomEvent.findMany({
        where: { fileUuid, id: { in: unique } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case EntityType.note: {
      const rows = await prisma.gedcomNote.findMany({
        where: { fileUuid, id: { in: unique } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case EntityType.source: {
      const rows = await prisma.gedcomSource.findMany({
        where: { fileUuid, id: { in: unique } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case EntityType.place: {
      const rows = await prisma.gedcomPlace.findMany({
        where: { fileUuid, id: { in: unique } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case EntityType.date: {
      const rows = await prisma.gedcomDate.findMany({
        where: { fileUuid, id: { in: unique } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    default:
      return [];
  }
}

/**
 * Apply one or more tags to many GEDCOM-scoped entities in the admin tree (`TaggedItem`).
 */
export const POST = withAdminAuth(async (request, user) => {
  const fileUuid = await getAdminFileUuid();
  const file = await prisma.gedcomFile.findUnique({
    where: { id: fileUuid },
    select: { fileId: true },
  });
  if (!file) {
    return NextResponse.json({ error: "Gedcom file not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const entityType = parseEntityType(body.entityType);
  if (!entityType || !BATCH_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ error: "Invalid or unsupported entityType" }, { status: 400 });
  }

  const rawEntityIds = Array.isArray(body.entityIds) ? body.entityIds : [];
  const entityIds = rawEntityIds
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);

  const rawTagIds = Array.isArray(body.tagIds) ? body.tagIds : [];
  const tagIds = [...new Set(rawTagIds.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean))];

  if (entityIds.length === 0 || tagIds.length === 0) {
    return NextResponse.json({ error: "entityIds and tagIds are required" }, { status: 400 });
  }
  if (entityIds.length > MAX_ENTITY_IDS || tagIds.length > MAX_TAG_IDS) {
    return NextResponse.json(
      { error: `Too many ids (max ${MAX_ENTITY_IDS} entities, ${MAX_TAG_IDS} tags)` },
      { status: 400 },
    );
  }

  const tags = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true },
  });
  if (tags.length !== tagIds.length) {
    return NextResponse.json({ error: "One or more tags were not found" }, { status: 400 });
  }

  const validEntityIds = await filterEntityIdsInFile(fileUuid, entityType, entityIds);
  if (validEntityIds.length === 0) {
    return NextResponse.json({ error: "No matching entities in this tree" }, { status: 400 });
  }

  const rows: Array<{
    tagId: string;
    taggedBy: string;
    entityType: EntityType;
    fileId: string;
    entityId: string;
  }> = [];
  for (const entityId of validEntityIds) {
    for (const tagId of tagIds) {
      rows.push({
        tagId,
        taggedBy: user.id,
        entityType,
        fileId: file.fileId,
        entityId,
      });
    }
  }

  const result = await prisma.taggedItem.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return NextResponse.json({
    created: result.count,
    entityCount: validEntityIds.length,
    tagCount: tagIds.length,
  });
});
