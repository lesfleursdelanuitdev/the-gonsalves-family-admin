import { Prisma } from "@ligneous/prisma";

/**
 * Join SQL conditions with AND. Returns a safe Prisma.Sql fragment.
 * Callers must ensure conditions is non-empty.
 */
export function joinAndConditions(conditions: Prisma.Sql[]): Prisma.Sql {
  return Prisma.join(conditions, " AND ");
}

/**
 * Parse a year search parameter into a number or null.
 * Shared between events and individuals filter SQL.
 */
export function parseYearParam(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}
