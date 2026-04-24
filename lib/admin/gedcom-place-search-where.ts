import type { Prisma } from "@ligneous/prisma";

const PLACE_TEXT_FIELDS = ["original", "name", "county", "state", "country"] as const;

/** One token must appear (substring, case-insensitive) in at least one text column. */
function tokenMatchesAnyField(token: string): Prisma.GedcomPlaceWhereInput {
  return {
    OR: PLACE_TEXT_FIELDS.map((field) => ({
      [field]: { contains: token, mode: "insensitive" as const },
    })),
  };
}

/**
 * Build `where` fragment for place list search.
 * - Single token: match that substring in any text column (OR across columns).
 * - Multiple tokens: each token must match some column (AND across tokens); per token, OR across columns.
 *
 * This fixes joined queries like "Concord California" when `name` is only "Concord" and `state` is "California".
 */
export function gedcomPlaceSearchWhereFromQuery(qRaw: string): Prisma.GedcomPlaceWhereInput | undefined {
  const q = qRaw.trim();
  if (!q) return undefined;

  const tokens = [...new Set(q.split(/\s+/).filter((t) => t.length > 0))];
  if (tokens.length === 0) return undefined;

  if (tokens.length === 1) {
    return tokenMatchesAnyField(tokens[0]!);
  }

  return { AND: tokens.map((token) => tokenMatchesAnyField(token)) };
}
