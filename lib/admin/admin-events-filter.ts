import type { Prisma } from "@ligneous/prisma";

export { parseYearParam } from "@/lib/admin/admin-sql-helpers";

export type AdminEventsLinkTypeParam = "individual" | "family" | "";

export function parseLinkTypeParam(raw: string | null): AdminEventsLinkTypeParam {
  if (raw === "individual" || raw === "family") return raw;
  return "";
}

export interface AdminEventsStructuredFilters {
  eventType: string | null;
  placeContains: string | null;
  dateYearMin: number | null;
  dateYearMax: number | null;
  linkType: AdminEventsLinkTypeParam;
  /** Lowercased substring for structured given-name on linked individuals. */
  linkedGiven: string | null;
  /** Trimmed GEDCOM-aware surname prefix on linked individuals' full_name_lower. */
  linkedLast: string | null;
  /** Family-linked events: partner search fields (p1/p2); same unordered-pair semantics as the families list API. */
  p1Given: string | null;
  p1Last: string | null;
  p2Given: string | null;
  p2Last: string | null;
  /**
   * Family-linked events: match if either spouse satisfies the given + last name criteria
   * (same slash-aware surname rules as individual linked search).
   */
  familyPartnerGiven: string | null;
  familyPartnerLast: string | null;
}

export function hasStructuredEventFilters(f: AdminEventsStructuredFilters): boolean {
  return !!(
    f.eventType ||
    f.placeContains ||
    f.dateYearMin != null ||
    f.dateYearMax != null ||
    f.linkType ||
    f.linkedGiven ||
    f.linkedLast ||
    f.p1Given ||
    f.p1Last ||
    f.p2Given ||
    f.p2Last ||
    f.familyPartnerGiven ||
    f.familyPartnerLast
  );
}

/** Name-based filters require raw SQL (~* + name forms / partner joins). */
export function adminEventsRequiresRawSql(f: AdminEventsStructuredFilters): boolean {
  return !!(
    f.linkedGiven ||
    f.linkedLast ||
    f.p1Given ||
    f.p1Last ||
    f.p2Given ||
    f.p2Last ||
    f.familyPartnerGiven ||
    f.familyPartnerLast
  );
}

export function buildAdminEventsWhere(
  fileUuid: string,
  filters: AdminEventsStructuredFilters,
  q: string | null
): Prisma.GedcomEventWhereInput {
  const where: Prisma.GedcomEventWhereInput = { fileUuid };
  const and: Prisma.GedcomEventWhereInput[] = [];

  if (filters.eventType) {
    where.eventType = filters.eventType;
  }

  const placeTrim = filters.placeContains?.trim() || "";
  if (placeTrim) {
    and.push({
      place: {
        is: {
          OR: [
            { original: { contains: placeTrim, mode: "insensitive" } },
            { name: { contains: placeTrim, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (filters.dateYearMin != null || filters.dateYearMax != null) {
    let yMin = filters.dateYearMin;
    let yMax = filters.dateYearMax;
    if (yMin != null && yMax != null && yMin > yMax) {
      const t = yMin;
      yMin = yMax;
      yMax = t;
    }
    const yearFilter: Prisma.IntFilter = {};
    if (yMin != null) yearFilter.gte = yMin;
    if (yMax != null) yearFilter.lte = yMax;
    and.push({
      date: { is: { year: yearFilter } },
    });
  }

  if (filters.linkType === "individual") {
    and.push({ individualEvents: { some: {} } });
  } else if (filters.linkType === "family") {
    and.push({ familyEvents: { some: {} } });
  }

  const qTrim = q?.trim() || "";
  if (qTrim) {
    and.push({
      OR: [
        { eventType: { contains: qTrim, mode: "insensitive" } },
        { customType: { contains: qTrim, mode: "insensitive" } },
        {
          place: {
            is: {
              OR: [
                { original: { contains: qTrim, mode: "insensitive" } },
                { name: { contains: qTrim, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}
