/** Partial calendar anchor for lifespan filtering (subject person). */
export type LifespanYmd = {
  year: number | null;
  month: number | null;
  day: number | null;
};

function lowerTuple(y: number | null, m: number | null, d: number | null): [number, number, number] | null {
  if (y == null) return null;
  return [y, m ?? 1, d ?? 1];
}

function upperTuple(y: number | null, m: number | null, d: number | null): [number, number, number] | null {
  if (y == null) return null;
  return [y, m ?? 12, d ?? 31];
}

function compareTuple(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Remove only events that are **provably** outside the subject's life:
 * - entire dated range strictly before known birth, or
 * - entire dated range strictly after known death.
 * Undated events (`year` null) are kept. Unknown birth or death disables that bound.
 */
export function filterEventsWithinSubjectLifespan<
  T extends { year: number | null; month: number | null; day: number | null },
>(events: T[], birth: LifespanYmd | null, death: LifespanYmd | null): T[] {
  const birthLo = birth?.year != null ? lowerTuple(birth.year, birth.month, birth.day) : null;
  const deathHi = death?.year != null ? upperTuple(death.year, death.month, death.day) : null;

  return events.filter((e) => {
    if (e.year == null) return true;
    const evLo = lowerTuple(e.year, e.month, e.day);
    const evHi = upperTuple(e.year, e.month, e.day);
    if (!evLo || !evHi) return true;

    if (birthLo) {
      if (compareTuple(evHi, birthLo) < 0) return false;
    }
    if (deathHi) {
      if (compareTuple(evLo, deathHi) > 0) return false;
    }
    return true;
  });
}
