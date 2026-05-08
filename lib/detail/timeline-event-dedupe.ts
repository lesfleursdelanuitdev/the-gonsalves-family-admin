/**
 * Deduplicate aggregated timeline rows. Real GEDCOM rows use `eventId`;
 * denormalized rows (e.g. spouse death from individual columns) use a stable synthetic key.
 */
export function dedupeTimelineEvents<
  T extends {
    eventId: string | null;
    source: string;
    eventType: string;
    year: number | null;
    month: number | null;
    day: number | null;
    familyId: string | null;
    childIndividualId?: string | null;
    spouseIndividualId?: string | null;
    dateOriginal?: string | null;
  },
>(events: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of events) {
    const key = e.eventId
      ? `id:${e.eventId}`
      : [
          "denorm",
          e.source,
          e.eventType,
          e.year ?? "_",
          e.month ?? "_",
          e.day ?? "_",
          e.familyId ?? "_",
          e.childIndividualId ?? "_",
          e.spouseIndividualId ?? "_",
          (e.dateOriginal ?? "").slice(0, 64),
        ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
