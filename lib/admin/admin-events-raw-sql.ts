import { Prisma } from "@ligneous/prisma";
import { escapeLike } from "@/lib/gedcom/gedcom-name-search";
import { givenNameExistsSql, lastNameRegexSql, linkedIndividualExistsSql } from "@/lib/admin/admin-linked-name-sql";
import { joinAndConditions } from "@/lib/admin/admin-sql-helpers";
import type { AdminEventsStructuredFilters } from "@/lib/admin/admin-events-filter";

/**
 * EXISTS: event is linked to a family whose husband/wife match optional partner name filters.
 */
/**
 * EXISTS: family-linked event where either spouse matches optional given (name forms) + last (slash-aware) together.
 */
function familyAnyPartnerNameMatchExistsSql(
  given: string | null | undefined,
  last: string | null | undefined,
): Prisma.Sql | null {
  const g = given?.trim().toLowerCase() || "";
  const l = last?.trim() || "";
  if (!g && !l) return null;

  const hParts: Prisma.Sql[] = [];
  const wParts: Prisma.Sql[] = [];
  if (g) {
    hParts.push(givenNameExistsSql(Prisma.raw("h_any.id"), g));
    wParts.push(givenNameExistsSql(Prisma.raw("w_any.id"), g));
  }
  if (l) {
    hParts.push(lastNameRegexSql(Prisma.raw("h_any.full_name_lower"), l));
    wParts.push(lastNameRegexSql(Prisma.raw("w_any.full_name_lower"), l));
  }
  const hCond = hParts.length ? joinAndConditions(hParts) : null;
  const wCond = wParts.length ? joinAndConditions(wParts) : null;
  const ors: Prisma.Sql[] = [];
  if (hCond) ors.push(Prisma.sql`(h_any.id IS NOT NULL AND (${hCond}))`);
  if (wCond) ors.push(Prisma.sql`(w_any.id IS NOT NULL AND (${wCond}))`);
  if (ors.length === 0) return null;
  const innerOr = Prisma.join(ors, " OR ");
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM gedcom_family_events_v2 fe_any
    INNER JOIN gedcom_families_v2 fam_any ON fam_any.id = fe_any.family_id
    LEFT JOIN gedcom_individuals_v2 h_any ON h_any.id = fam_any.husband_id
    LEFT JOIN gedcom_individuals_v2 w_any ON w_any.id = fam_any.wife_id
    WHERE fe_any.event_id = e.id AND (${innerOr})
  )`;
}

function familyLinkedEventPartnerMatchExistsSql(f: AdminEventsStructuredFilters): Prisma.Sql | null {
  const parts: Prisma.Sql[] = [];
  if (f.p1Given) {
    parts.push(
      Prisma.sql`(h_filt.id IS NOT NULL AND ${givenNameExistsSql(Prisma.raw("h_filt.id"), f.p1Given)})`,
    );
  }
  if (f.p1Last) {
    parts.push(
      Prisma.sql`(h_filt.id IS NOT NULL AND ${lastNameRegexSql(Prisma.raw("h_filt.full_name_lower"), f.p1Last)})`,
    );
  }
  if (f.p2Given) {
    parts.push(
      Prisma.sql`(w_filt.id IS NOT NULL AND ${givenNameExistsSql(Prisma.raw("w_filt.id"), f.p2Given)})`,
    );
  }
  if (f.p2Last) {
    parts.push(
      Prisma.sql`(w_filt.id IS NOT NULL AND ${lastNameRegexSql(Prisma.raw("w_filt.full_name_lower"), f.p2Last)})`,
    );
  }
  if (parts.length === 0) return null;
  const inner = joinAndConditions(parts);
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM gedcom_family_events_v2 fe_nm
    INNER JOIN gedcom_families_v2 fam_nm ON fam_nm.id = fe_nm.family_id
    LEFT JOIN gedcom_individuals_v2 h_filt ON h_filt.id = fam_nm.husband_id
    LEFT JOIN gedcom_individuals_v2 w_filt ON w_filt.id = fam_nm.wife_id
    WHERE fe_nm.event_id = e.id AND (${inner})
  )`;
}

/**
 * WHERE fragments for `gedcom_events_v2` aliased as `e` (linked-person name filters).
 */
export function adminEventsRawConditions(
  fileUuid: string,
  filters: AdminEventsStructuredFilters,
  q: string | null
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [Prisma.sql`e.file_uuid = ${fileUuid}::uuid`];

  if (filters.eventType) {
    parts.push(Prisma.sql`e.event_type = ${filters.eventType}`);
  }

  const placeTrim = filters.placeContains?.trim() || "";
  if (placeTrim) {
    const pat = `%${escapeLike(placeTrim)}%`;
    parts.push(Prisma.sql`e.place_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM gedcom_places_v2 pl
      WHERE pl.id = e.place_id
        AND (pl.original ILIKE ${pat} ESCAPE '\\' OR pl.name ILIKE ${pat} ESCAPE '\\')
    )`);
  }

  if (filters.dateYearMin != null || filters.dateYearMax != null) {
    let yMin = filters.dateYearMin;
    let yMax = filters.dateYearMax;
    if (yMin != null && yMax != null && yMin > yMax) {
      const t = yMin;
      yMin = yMax;
      yMax = t;
    }
    const yearParts: Prisma.Sql[] = [];
    if (yMin != null) yearParts.push(Prisma.sql`dt.year >= ${yMin}`);
    if (yMax != null) yearParts.push(Prisma.sql`dt.year <= ${yMax}`);
    const yearAnd = joinAndConditions(yearParts);
    parts.push(Prisma.sql`e.date_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM gedcom_dates_v2 dt
      WHERE dt.id = e.date_id AND dt.year IS NOT NULL AND ${yearAnd}
    )`);
  }

  const hasName = !!(filters.linkedGiven || filters.linkedLast);

  if (filters.linkType === "individual" && !hasName) {
    parts.push(
      Prisma.sql`EXISTS (SELECT 1 FROM gedcom_individual_events_v2 ie0 WHERE ie0.event_id = e.id)`
    );
  } else if (filters.linkType === "family") {
    const famAny = familyAnyPartnerNameMatchExistsSql(filters.familyPartnerGiven, filters.familyPartnerLast);
    const famNm = familyLinkedEventPartnerMatchExistsSql(filters);
    if (famAny) {
      parts.push(famAny);
    } else if (famNm) {
      parts.push(famNm);
    } else {
      parts.push(
        Prisma.sql`EXISTS (SELECT 1 FROM gedcom_family_events_v2 fe0 WHERE fe0.event_id = e.id)`
      );
    }
  }

  if (hasName && filters.linkType !== "family") {
    const nameExists = linkedIndividualExistsSql(
      "gedcom_individual_events_v2",
      "event_id",
      "e",
      filters.linkedGiven,
      filters.linkedLast,
    );
    if (nameExists) parts.push(nameExists);
  }

  const qTrim = q?.trim() || "";
  if (qTrim) {
    const pat = `%${escapeLike(qTrim)}%`;
    parts.push(Prisma.sql`(
      e.event_type ILIKE ${pat} ESCAPE '\\'
      OR e.custom_type ILIKE ${pat} ESCAPE '\\'
      OR (e.place_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM gedcom_places_v2 plq
        WHERE plq.id = e.place_id
          AND (plq.original ILIKE ${pat} ESCAPE '\\' OR plq.name ILIKE ${pat} ESCAPE '\\')
      ))
    )`);
  }

  return parts;
}

export function adminEventsRawWhereSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return joinAndConditions(conditions);
}
