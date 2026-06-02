/**
 * Shared SQL builders for filtering records by a linked individual's name.
 * Used by events, notes, media, individuals, and families filter files.
 */
import { Prisma } from "@ligneous/prisma";
import { escapeLike, surnamePrefixRegexPattern } from "@/lib/gedcom/gedcom-name-search";

/**
 * EXISTS subquery matching an individual's given name via the name-forms tables,
 * with a full_name_lower fallback for individuals whose name-form chain is incomplete
 * (e.g. some GEDCOM imports where given-name rows weren't created).
 *
 * @param individualIdExpr - SQL expression for the individual ID column (e.g. `Prisma.raw("i.id")`)
 * @param fullNameExpr - optional SQL expression for full_name_lower (fallback LIKE match)
 */
export function givenNameExistsSql(
  individualIdExpr: Prisma.Sql,
  givenNameLower: string,
  fullNameExpr?: Prisma.Sql,
): Prisma.Sql {
  const likePattern = `%${escapeLike(givenNameLower)}%`;
  const existsPart = Prisma.sql`EXISTS (
    SELECT 1
    FROM gedcom_individual_name_forms inf
    INNER JOIN gedcom_name_form_given_names nfgn ON nfgn.name_form_id = inf.id
    INNER JOIN gedcom_given_names_v2 gn ON gn.id = nfgn.given_name_id
    WHERE inf.individual_id = ${individualIdExpr}
      AND gn.given_name_lower LIKE ${likePattern} ESCAPE '\\'
  )`;
  if (fullNameExpr) {
    return Prisma.sql`(${existsPart} OR ${fullNameExpr} LIKE ${likePattern} ESCAPE '\\')`;
  }
  return existsPart;
}

/**
 * Match surname prefix on full_name_lower (GEDCOM slash token) and primary_surname_lower.
 * @param fullNameExpr - SQL expression for the full_name_lower column
 * @param primarySurnameExpr - optional SQL expression for primary_surname_lower
 */
export function lastNameRegexSql(
  fullNameExpr: Prisma.Sql,
  lastNamePrefix: string,
  primarySurnameExpr?: Prisma.Sql,
): Prisma.Sql {
  const pattern = surnamePrefixRegexPattern(lastNamePrefix);
  const primaryPrefix = lastNamePrefix.trim().toLowerCase() + "%";
  if (primarySurnameExpr) {
    return Prisma.sql`(${fullNameExpr} ~* ${pattern} OR ${primarySurnameExpr} LIKE ${primaryPrefix})`;
  }
  return Prisma.sql`${fullNameExpr} ~* ${pattern}`;
}

/**
 * Build an array of conditions (given + last) for a linked individual.
 * Returns an empty array when neither filter is set.
 */
export function linkedNameConditions(
  individualIdExpr: Prisma.Sql,
  fullNameExpr: Prisma.Sql,
  givenName: string | null | undefined,
  lastName: string | null | undefined,
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [];
  if (givenName) {
    parts.push(givenNameExistsSql(individualIdExpr, givenName));
  }
  if (lastName) {
    parts.push(lastNameRegexSql(fullNameExpr, lastName, Prisma.raw("i.primary_surname_lower")));
  }
  return parts;
}

/**
 * Full EXISTS subquery for filtering a parent row (event/note/media) by a linked individual's name.
 * @param linkTable - Bridge table name (e.g. "gedcom_individual_events_v2")
 * @param linkColumn - Foreign key back to parent (e.g. "event_id")
 * @param parentAlias - Parent table alias (e.g. "e")
 */
export function linkedIndividualExistsSql(
  linkTable: string,
  linkColumn: string,
  parentAlias: string,
  givenName: string | null | undefined,
  lastName: string | null | undefined,
): Prisma.Sql | null {
  const nameParts = linkedNameConditions(
    Prisma.raw("i.id"),
    Prisma.raw("i.full_name_lower"),
    givenName,
    lastName,
  );
  if (nameParts.length === 0) return null;
  const innerWhere = Prisma.join(nameParts, " AND ");
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM ${Prisma.raw(linkTable)} lnk
    INNER JOIN gedcom_individuals_v2 i ON i.id = lnk.individual_id
    WHERE lnk.${Prisma.raw(linkColumn)} = ${Prisma.raw(parentAlias)}.id
      AND (${innerWhere})
  )`;
}
