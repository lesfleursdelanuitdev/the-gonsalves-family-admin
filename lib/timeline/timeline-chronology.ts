import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";

function ymdScore(e: IndividualDetailEvent): number | null {
  if (e.year == null) return null;
  return e.year * 10_000 + (e.month ?? 0) * 100 + (e.day ?? 0);
}

/**
 * Stable chronological order for timeline cards (earliest first).
 * Rows without structured year sort after dated rows, using `dateOriginal` then `sortOrder`.
 */
export function sortEventsChronologically(events: IndividualDetailEvent[]): IndividualDetailEvent[] {
  return [...events].sort((a, b) => {
    const sa = ymdScore(a);
    const sb = ymdScore(b);
    if (sa != null && sb != null && sa !== sb) return sa - sb;
    if (sa != null && sb == null) return -1;
    if (sa == null && sb != null) return 1;
    if (sa != null && sb != null) {
      const mo = (a.month ?? 0) - (b.month ?? 0);
      if (mo !== 0) return mo;
      const d = (a.day ?? 0) - (b.day ?? 0);
      if (d !== 0) return d;
    }
    const ao = (a.dateOriginal ?? "").trim();
    const bo = (b.dateOriginal ?? "").trim();
    if (ao !== bo) return ao.localeCompare(bo);
    return a.sortOrder - b.sortOrder;
  });
}
