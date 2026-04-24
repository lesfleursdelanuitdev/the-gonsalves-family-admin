import { GedcomDateType, type Prisma } from "@ligneous/prisma";

const DATE_TYPE_VALUES = new Set(Object.values(GedcomDateType) as string[]);

/**
 * One search token must match: `original` (substring), a recognized `dateType`, and/or
 * structured year / month / day / end fields when the token is numeric.
 */
function tokenMatchesGedcomDate(token: string): Prisma.GedcomDateWhereInput {
  const t = token.trim();
  const or: Prisma.GedcomDateWhereInput[] = [
    { original: { contains: t, mode: "insensitive" } },
  ];

  const upper = t.toUpperCase();
  if (DATE_TYPE_VALUES.has(upper)) {
    or.push({ dateType: upper as GedcomDateType });
  }

  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    if (!Number.isNaN(n)) {
      if (n >= 1000 && n <= 9999) {
        or.push({ year: n });
        or.push({ endYear: n });
      } else if (n >= 100 && n <= 999) {
        or.push({ year: n });
        or.push({ endYear: n });
      } else if (n >= 13 && n <= 31) {
        or.push({ day: n });
        or.push({ endDay: n });
      } else if (n >= 1 && n <= 12) {
        or.push({ month: n });
        or.push({ endMonth: n });
      }
    }
  }

  return { OR: or };
}

/**
 * Build `where` fragment for admin date list search (same multi-token AND idea as places).
 * - Single token: one `tokenMatchesGedcomDate` clause.
 * - Multiple tokens: each must match via its own OR clause (AND across tokens).
 */
export function gedcomDateSearchWhereFromQuery(qRaw: string): Prisma.GedcomDateWhereInput | undefined {
  const q = qRaw.trim();
  if (!q) return undefined;

  const tokens = [...new Set(q.split(/\s+/).filter((t) => t.length > 0))];
  if (tokens.length === 0) return undefined;

  if (tokens.length === 1) {
    return tokenMatchesGedcomDate(tokens[0]!);
  }

  return { AND: tokens.map((token) => tokenMatchesGedcomDate(token)) };
}
