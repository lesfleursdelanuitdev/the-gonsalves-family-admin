import { prisma } from "../database/prisma.ts";

/**
 * Collects site-specific data that isn't carried by the GEDCOM/JSON export:
 * stories, custom types, settings, open questions, tags, recipes, glossary.
 * The pg_dump is the authoritative restore source; this provides human-readable
 * portability for non-GEDCOM entities.
 */
export async function buildBackupExtras(
  fileUuid: string,
  treeId: string,
): Promise<Record<string, unknown>> {
  const [
    treeSettings,
    customEventTypes,
    customAttributeTypes,
    stories,
    openQuestions,
    tags,
    glossaryEntries,
    recipes,
  ] = await Promise.all([
    prisma.treeSettings.findUnique({ where: { treeId } }),
    prisma.eventType.findMany({ where: { fileUuid, isCustom: true }, orderBy: { tag: "asc" } }),
    prisma.attributeType.findMany({ where: { fileUuid, isCustom: true }, orderBy: { tag: "asc" } }),
    prisma.story.findMany({
      where: { treeId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, title: true, slug: true, kind: true, status: true,
        excerpt: true, createdAt: true, updatedAt: true,
        chapters: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true, slug: true, sortOrder: true },
        },
      },
    }),
    prisma.openQuestion.findMany({
      where: { fileUuid },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, question: true, details: true, status: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.tag.findMany({
      where: { isGlobal: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, description: true, isGlobal: true },
    }),
    prisma.glossaryEntry.findMany({
      where: { treeId },
      orderBy: { word: "asc" },
      select: { id: true, word: true, slug: true, meaning: true, dialect: true, partOfSpeech: true },
    }),
    prisma.recipe.findMany({
      where: { treeId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, title: true, slug: true, status: true, servings: true,
        prepMinutes: true, cookMinutes: true, createdAt: true,
      },
    }),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    treeSettings,
    customEventTypes,
    customAttributeTypes,
    stories,
    openQuestions,
    tags,
    glossaryEntries,
    recipes,
  };
}
