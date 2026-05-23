import { prisma } from "@/lib/database/prisma";

/**
 * After creating or deleting a link, re-evaluate suggestion status for any
 * suggestions that contain this gedcomPlaceId.
 *
 *   all items linked  → "applied"
 *   some items linked → "partial"
 *   no  items linked  → "pending"
 *
 * Ignored suggestions are never touched.
 */
export async function syncSuggestionStatus(gedcomPlaceId: string): Promise<void> {
  const items = await prisma.placeResolutionSuggestionItem.findMany({
    where: { gedcomPlaceId },
    select: { suggestionId: true },
  });

  for (const { suggestionId } of items) {
    const suggestion = await prisma.placeResolutionSuggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true, status: true },
    });
    if (!suggestion || suggestion.status === "ignored") continue;

    const allItems = await prisma.placeResolutionSuggestionItem.findMany({
      where: { suggestionId },
      select: { gedcomPlaceId: true },
    });

    const linkedCount = (
      await prisma.resolvedPlaceLink.findMany({
        where: { gedcomPlaceId: { in: allItems.map((i) => i.gedcomPlaceId) } },
        select: { id: true },
      })
    ).length;

    const newStatus =
      linkedCount === 0 ? "pending" :
      linkedCount === allItems.length ? "applied" :
      "partial";

    if (newStatus !== suggestion.status) {
      await prisma.placeResolutionSuggestion.update({
        where: { id: suggestionId },
        data: { status: newStatus },
      });
    }
  }
}
