import { Prisma } from "@ligneous/prisma";

/** GEDCOM-style multimedia record id: `@M` + digits + `@` (matches common OBJE xrefs). */
const MEDIA_NUMERIC_XREF = /^@M(\d+)@$/;

export function parseMediaXrefNumber(xref: string | null | undefined): number | null {
  if (xref == null) return null;
  const m = String(xref).trim().match(MEDIA_NUMERIC_XREF);
  if (!m) return null;
  return Number.parseInt(m[1]!, 10);
}

/**
 * Allocates `howMany` new xrefs that do not collide with any `@Mn@` already present
 * in `occupiedXrefs` (null/empty entries ignored). Uses the smallest integers strictly
 * greater than the current max `@M…@` number, skipping any integers already in use.
 */
export function nextMediaXrefsAfterOccupied(
  occupiedXrefs: readonly (string | null | undefined)[],
  howMany: number,
): string[] {
  let maxN = 0;
  const used = new Set<number>();
  for (const x of occupiedXrefs) {
    const n = parseMediaXrefNumber(x);
    if (n != null) {
      used.add(n);
      maxN = Math.max(maxN, n);
    }
  }
  const out: string[] = [];
  let c = maxN + 1;
  for (let i = 0; i < howMany; i++) {
    while (used.has(c)) c += 1;
    out.push(`@M${c}@`);
    used.add(c);
    c += 1;
  }
  return out;
}

/**
 * Reserves the next `@Mn@` xref for this tree (`fileUuid`) inside an interactive
 * transaction. Uses `pg_advisory_xact_lock` so concurrent creates cannot pick the
 * same number (see `@@unique([fileUuid, xref])` on `GedcomMedia`).
 */
export async function reserveNextGedcomMediaXref(tx: Prisma.TransactionClient, fileUuid: string): Promise<string> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${fileUuid}::text)::bigint)`);
  const rows = await tx.gedcomMedia.findMany({
    where: { fileUuid },
    select: { xref: true },
  });
  const next = nextMediaXrefsAfterOccupied(
    rows.map((r) => r.xref),
    1,
  );
  return next[0]!;
}
