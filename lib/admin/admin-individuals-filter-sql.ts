import { Prisma } from "@ligneous/prisma";
import {
  parseNameQuery,
  escapeLike,
  surnamePrefixRegexPattern,
} from "@/lib/gedcom/gedcom-name-search";
import { givenNameExistsSql, lastNameRegexSql } from "@/lib/admin/admin-linked-name-sql";
import { joinAndConditions } from "@/lib/admin/admin-sql-helpers";

export { parseYearParam } from "@/lib/admin/admin-sql-helpers";

const GEDCOM_SEX = new Set(["M", "F", "U", "X"]);

export interface AdminIndividualsStructuredFilters {
  sex: string | null;
  /** When null, do not filter by living. */
  isLiving: boolean | null;
  /** Lowercased substring for given-name contains (already normalized). */
  givenContains: string | null;
  /** Trimmed prefix for GEDCOM slash-aware surname match. */
  lastNamePrefix: string | null;
  birthYearMin: number | null;
  birthYearMax: number | null;
  deathYearMin: number | null;
  deathYearMax: number | null;
}

export function parseSexParam(raw: string | null): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  return GEDCOM_SEX.has(u) ? u : null;
}

export function parseLivingParam(
  searchParams: URLSearchParams
): boolean | null {
  if (!searchParams.has("living")) return null;
  const v = searchParams.get("living");
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function hasStructuredFilters(f: AdminIndividualsStructuredFilters): boolean {
  return !!(
    f.sex ||
    f.isLiving !== null ||
    f.givenContains ||
    f.lastNamePrefix ||
    f.birthYearMin != null ||
    f.birthYearMax != null ||
    f.deathYearMin != null ||
    f.deathYearMax != null
  );
}

/**
 * Build AND conditions for structured filters + optional legacy `q` name query.
 * Always includes `i.file_uuid = $fileUuid`.
 */
export function adminIndividualsFilterConditions(
  fileUuid: string,
  structured: AdminIndividualsStructuredFilters,
  q: string | null
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [Prisma.sql`i.file_uuid = ${fileUuid}::uuid`];

  if (structured.sex) {
    parts.push(Prisma.sql`i.sex::text = ${structured.sex}`);
  }
  if (structured.isLiving !== null) {
    parts.push(Prisma.sql`i.is_living = ${structured.isLiving}`);
  }
  if (structured.birthYearMin != null) {
    parts.push(Prisma.sql`i.birth_year IS NOT NULL AND i.birth_year >= ${structured.birthYearMin}`);
  }
  if (structured.birthYearMax != null) {
    parts.push(Prisma.sql`i.birth_year IS NOT NULL AND i.birth_year <= ${structured.birthYearMax}`);
  }
  if (structured.deathYearMin != null) {
    parts.push(Prisma.sql`i.death_year IS NOT NULL AND i.death_year >= ${structured.deathYearMin}`);
  }
  if (structured.deathYearMax != null) {
    parts.push(Prisma.sql`i.death_year IS NOT NULL AND i.death_year <= ${structured.deathYearMax}`);
  }

  if (structured.lastNamePrefix) {
    parts.push(lastNameRegexSql(Prisma.raw("i.full_name_lower"), structured.lastNamePrefix));
  }

  if (structured.givenContains) {
    parts.push(givenNameExistsSql(Prisma.raw("i.id"), structured.givenContains));
  }

  const qTrim = q?.trim() || "";
  if (qTrim) {
    const parsed = parseNameQuery(qTrim);
    if (parsed) {
      const { firstToken, surnamePrefix, hasSurname } = parsed;
      if (hasSurname && surnamePrefix) {
        const givenPrefix = escapeLike(firstToken) + "%";
        const surnamePattern = surnamePrefixRegexPattern(surnamePrefix);
        parts.push(Prisma.sql`i.full_name_lower LIKE ${givenPrefix} ESCAPE '\\'`);
        parts.push(Prisma.sql`i.full_name_lower ~* ${surnamePattern}`);
      } else {
        const likePrefix = escapeLike(firstToken) + "%";
        const surnamePattern = surnamePrefixRegexPattern(firstToken);
        parts.push(Prisma.sql`(i.full_name_lower LIKE ${likePrefix} ESCAPE '\\' OR i.full_name_lower ~* ${surnamePattern})`);
      }
    }
  }

  return parts;
}

export function adminIndividualsWhereSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return joinAndConditions(conditions);
}
