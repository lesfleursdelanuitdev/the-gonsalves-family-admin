/**
 * Internal duplicate scan — finds likely-duplicate individuals within the existing tree
 * without requiring a new GEDCOM import. Uses SQL-level matching:
 *   1. Exact fullNameLower match (same tree, different IDs)
 *   2. Same birth year + trigram-similar name (pg_trgm similarity)
 *
 * Results are stored as InternalDuplicatePair[] in internal_duplicate_scans.pairs_json.
 */
import { prisma } from "@/lib/database/prisma";

// ── Types (also exported for use in API routes and UI) ────────────────────────

export type InternalDuplicateResolution =
  | "merge_a_into_b"   // keep B, merge A's data into B, delete A
  | "merge_b_into_a"   // keep A, merge B's data into A, delete B
  | "not_duplicate"    // confirmed not the same person
  | "review_later";    // needs more thought

export type InternalDuplicatePair = {
  pairId: string;
  individualAId: string;
  individualBId: string;
  aDisplay: string;
  bDisplay: string;
  /** How this pair was found */
  matchReason: "exact_name" | "name_and_birth_year" | "similar_name_birth_year";
  /** 0–100 */
  confidence: number;
  birthYearA: number | null;
  birthYearB: number | null;
};

export type InternalDuplicateScanSummary = {
  total: number;
  exactName: number;
  nameAndBirthYear: number;
  similarNameBirthYear: number;
};

// ── Display helpers ───────────────────────────────────────────────────────────

function displayLine(fullName: string, birthYear: number | null): string {
  if (birthYear) return `${fullName} (b. ${birthYear})`;
  return fullName;
}

// ── Scan logic ────────────────────────────────────────────────────────────────

type RawExactRow = {
  id_a: string;
  id_b: string;
  full_name_a: string;
  full_name_b: string;
  birth_year_a: number | null;
  birth_year_b: number | null;
};

type RawSimilarRow = {
  id_a: string;
  id_b: string;
  full_name_a: string;
  full_name_b: string;
  birth_year_a: number | null;
  birth_year_b: number | null;
  similarity: number;
};

export async function runInternalDuplicateScan(fileUuid: string): Promise<{
  pairs: InternalDuplicatePair[];
  summary: InternalDuplicateScanSummary;
}> {
  const pairs: InternalDuplicatePair[] = [];
  const seenPairs = new Set<string>();

  function pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function addPair(
    aId: string, bId: string,
    aName: string, bName: string,
    aYear: number | null, bYear: number | null,
    reason: InternalDuplicatePair["matchReason"],
    confidence: number,
  ) {
    const key = pairKey(aId, bId);
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    pairs.push({
      pairId: crypto.randomUUID(),
      individualAId: aId,
      individualBId: bId,
      aDisplay: displayLine(aName, aYear),
      bDisplay: displayLine(bName, bYear),
      matchReason: reason,
      confidence,
      birthYearA: aYear,
      birthYearB: bYear,
    });
  }

  // 1. Exact name match (fullNameLower) — highest confidence
  const exactRows = await prisma.$queryRaw<RawExactRow[]>`
    SELECT
      a.id          AS id_a,
      b.id          AS id_b,
      a.full_name   AS full_name_a,
      b.full_name   AS full_name_b,
      a.birth_year  AS birth_year_a,
      b.birth_year  AS birth_year_b
    FROM gedcom_individuals_v2 a
    JOIN gedcom_individuals_v2 b
      ON a.file_uuid = b.file_uuid
      AND a.full_name_lower = b.full_name_lower
      AND a.id < b.id
    WHERE a.file_uuid = ${fileUuid}::uuid
    ORDER BY a.full_name_lower
    LIMIT 500
  `;

  for (const row of exactRows) {
    addPair(row.id_a, row.id_b, row.full_name_a, row.full_name_b,
      row.birth_year_a, row.birth_year_b, "exact_name", 90);
  }

  // 2. Same birth year + exact name (catches case where names are equivalent but capitalisation differs slightly)
  const birthYearExactRows = await prisma.$queryRaw<RawExactRow[]>`
    SELECT
      a.id          AS id_a,
      b.id          AS id_b,
      a.full_name   AS full_name_a,
      b.full_name   AS full_name_b,
      a.birth_year  AS birth_year_a,
      b.birth_year  AS birth_year_b
    FROM gedcom_individuals_v2 a
    JOIN gedcom_individuals_v2 b
      ON a.file_uuid = b.file_uuid
      AND a.birth_year = b.birth_year
      AND a.id < b.id
    WHERE a.file_uuid = ${fileUuid}::uuid
      AND a.birth_year IS NOT NULL
      AND a.full_name_lower = b.full_name_lower
    LIMIT 500
  `;

  for (const row of birthYearExactRows) {
    addPair(row.id_a, row.id_b, row.full_name_a, row.full_name_b,
      row.birth_year_a, row.birth_year_b, "name_and_birth_year", 95);
  }

  // 3. Same birth year + high trigram similarity (pg_trgm) — catches name spelling variants
  let similarRows: RawSimilarRow[] = [];
  try {
    similarRows = await prisma.$queryRaw<RawSimilarRow[]>`
      SELECT
        a.id                                        AS id_a,
        b.id                                        AS id_b,
        a.full_name                                 AS full_name_a,
        b.full_name                                 AS full_name_b,
        a.birth_year                                AS birth_year_a,
        b.birth_year                                AS birth_year_b,
        similarity(a.full_name_lower, b.full_name_lower) AS similarity
      FROM gedcom_individuals_v2 a
      JOIN gedcom_individuals_v2 b
        ON a.file_uuid = b.file_uuid
        AND a.birth_year = b.birth_year
        AND a.id < b.id
        AND similarity(a.full_name_lower, b.full_name_lower) >= 0.6
      WHERE a.file_uuid = ${fileUuid}::uuid
        AND a.birth_year IS NOT NULL
        AND a.full_name_lower <> b.full_name_lower
      ORDER BY similarity DESC
      LIMIT 500
    `;
  } catch {
    // pg_trgm may not be enabled; skip this phase gracefully
  }

  for (const row of similarRows) {
    const conf = Math.round(row.similarity * 80); // max 80 for fuzzy matches
    addPair(row.id_a, row.id_b, row.full_name_a, row.full_name_b,
      row.birth_year_a, row.birth_year_b, "similar_name_birth_year", conf);
  }

  const summary: InternalDuplicateScanSummary = {
    total: pairs.length,
    exactName: pairs.filter((p) => p.matchReason === "exact_name").length,
    nameAndBirthYear: pairs.filter((p) => p.matchReason === "name_and_birth_year").length,
    similarNameBirthYear: pairs.filter((p) => p.matchReason === "similar_name_birth_year").length,
  };

  return { pairs, summary };
}
