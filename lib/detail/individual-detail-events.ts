/**
 * Builds the same event timeline as the public tree
 * `GET /api/tree/individuals/[xref]/detail/events` (the-gonsalves-family).
 * Keep in sync when that route changes.
 */
import { Prisma } from "@ligneous/prisma";
import type { PrismaClient } from "@ligneous/prisma";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export type IndividualDetailEvent = {
  /** Present when this row is backed by a `gedcom_events_v2` row (admin deep-link). */
  eventId: string | null;
  eventType: string;
  customType: string | null;
  value: string | null;
  cause: string | null;
  dateOriginal: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  placeOriginal: string | null;
  placeName: string | null;
  sortOrder: number;
  source: string;
  familyId: string | null;
  childXref: string | null;
  childName?: string | null;
  spouseName?: string | null;
  spouseXref?: string | null;
  /** Related person (spouse, parent, grandparent, etc.) for admin links */
  spouseIndividualId?: string | null;
  /** Child, sibling, grandchild, etc. for admin links */
  childIndividualId?: string | null;
  /** Family partners on family-detail MARR/DIV (optional) */
  husbandIndividualId?: string | null;
  wifeIndividualId?: string | null;
};

type Row = Record<string, unknown>;

/** `event_id` from family-event joins, or `id` from direct event selects. */
export function eventRowGedcomId(r: Row): string | null {
  if (r.event_id != null && String(r.event_id) !== "") return String(r.event_id);
  if (r.id != null && String(r.id) !== "") return String(r.id);
  return null;
}

function stripName(s: string | null | undefined): string | null {
  const t = stripSlashesFromName(s);
  return t === "" ? null : t;
}

export async function buildIndividualDetailEvents(
  prisma: PrismaClient,
  fileUuid: string,
  personId: string,
): Promise<{ events: IndividualDetailEvent[] }> {
  const [indEventRows, famSpouseRows] = await Promise.all([
    prisma.$queryRaw<Row[]>(
      Prisma.sql`
          SELECT e.id, e.event_type, e.custom_type, e.value, e.cause, e.sort_order,
                 d.original AS date_original, d.year, d.month, d.day,
                 p.original AS place_original, p.name AS place_name
          FROM gedcom_individual_events_v2 ie
          JOIN gedcom_events_v2 e ON e.id = ie.event_id AND e.file_uuid = ie.file_uuid
          LEFT JOIN gedcom_dates_v2 d ON d.id = e.date_id
          LEFT JOIN gedcom_places_v2 p ON p.id = e.place_id
          WHERE ie.file_uuid = ${fileUuid}::uuid AND ie.individual_id = ${personId}::uuid
          ORDER BY e.sort_order ASC, e.event_type
        `,
    ),
    prisma.$queryRaw<Row[]>(
      Prisma.sql`
          SELECT f.id AS family_id, f.xref AS family_xref,
                 spouse.id AS spouse_id, spouse.xref AS spouse_xref, spouse.full_name AS spouse_name,
                 spouse.death_date_display AS spouse_death_date, spouse.death_place_display AS spouse_death_place,
                 spouse_death_d.year AS spouse_death_year, spouse_death_d.month AS spouse_death_month, spouse_death_d.day AS spouse_death_day,
                 ch.id AS child_id, ch.xref AS child_xref, ch.full_name AS child_name,
                 ch.birth_date_display AS child_birth_date, ch.birth_place_display AS child_birth_place,
                 ch_birth_d.year AS child_birth_year, ch_birth_d.month AS child_birth_month, ch_birth_d.day AS child_birth_day,
                 ch.death_date_display AS child_death_date, ch.death_place_display AS child_death_place,
                 ch_death_d.year AS child_death_year, ch_death_d.month AS child_death_month, ch_death_d.day AS child_death_day
          FROM gedcom_families_v2 f
          LEFT JOIN gedcom_individuals_v2 spouse ON (spouse.id = f.wife_id AND f.husband_id = ${personId}::uuid)
            OR (spouse.id = f.husband_id AND f.wife_id = ${personId}::uuid)
          LEFT JOIN gedcom_dates_v2 spouse_death_d ON spouse_death_d.id = spouse.death_date_id
          LEFT JOIN gedcom_family_children_v2 fch ON fch.family_id = f.id AND fch.file_uuid = f.file_uuid
          LEFT JOIN gedcom_individuals_v2 ch ON ch.id = fch.child_id
          LEFT JOIN gedcom_dates_v2 ch_birth_d ON ch_birth_d.id = ch.birth_date_id
          LEFT JOIN gedcom_dates_v2 ch_death_d ON ch_death_d.id = ch.death_date_id
          WHERE f.file_uuid = ${fileUuid}::uuid
            AND (f.husband_id = ${personId}::uuid OR f.wife_id = ${personId}::uuid)
        `,
    ),
  ]);

  const spouseFamilyByKey = new Map<
    string,
    {
      family: { id: string; xref: string };
      spouse: {
        id: string;
        name: string | null;
        xref: string;
        death?: {
          date: string | null;
          place: string | null;
          year?: number | null;
          month?: number | null;
          day?: number | null;
        };
      };
      children: {
        name: string | null;
        xref: string;
        id: string;
        birth?: {
          date: string | null;
          place: string | null;
          year?: number | null;
          month?: number | null;
          day?: number | null;
        };
        death?: {
          date: string | null;
          place: string | null;
          year?: number | null;
          month?: number | null;
          day?: number | null;
        };
      }[];
    }
  >();
  for (const r of famSpouseRows) {
    const fid = r.family_id as string;
    if (!spouseFamilyByKey.has(fid)) {
      const hasSpouseDeath =
        r.spouse_death_date != null ||
        r.spouse_death_place != null ||
        r.spouse_death_year != null ||
        r.spouse_death_month != null ||
        r.spouse_death_day != null;
      spouseFamilyByKey.set(fid, {
        family: { id: fid, xref: (r.family_xref as string) ?? "" },
        spouse: {
          id: (r.spouse_id as string) ?? "",
          name: stripName(r.spouse_name as string),
          xref: (r.spouse_xref as string) ?? "",
          death: hasSpouseDeath
            ? {
                date: (r.spouse_death_date as string) ?? null,
                place: (r.spouse_death_place as string) ?? null,
                year: r.spouse_death_year != null ? Number(r.spouse_death_year) : null,
                month: r.spouse_death_month != null ? Number(r.spouse_death_month) : null,
                day: r.spouse_death_day != null ? Number(r.spouse_death_day) : null,
              }
            : undefined,
        },
        children: [],
      });
    }
    const entry = spouseFamilyByKey.get(fid)!;
    if (r.child_id && !entry.children.some((c) => c.xref === (r.child_xref as string))) {
      const hasBirth =
        r.child_birth_date != null ||
        r.child_birth_place != null ||
        r.child_birth_year != null ||
        r.child_birth_month != null ||
        r.child_birth_day != null;
      const hasDeath =
        r.child_death_date != null ||
        r.child_death_place != null ||
        r.child_death_year != null ||
        r.child_death_month != null ||
        r.child_death_day != null;
      entry.children.push({
        id: (r.child_id as string) ?? "",
        name: stripName(r.child_name as string),
        xref: (r.child_xref as string) ?? "",
        birth: hasBirth
          ? {
              date: (r.child_birth_date as string) ?? null,
              place: (r.child_birth_place as string) ?? null,
              year: r.child_birth_year != null ? Number(r.child_birth_year) : null,
              month: r.child_birth_month != null ? Number(r.child_birth_month) : null,
              day: r.child_birth_day != null ? Number(r.child_birth_day) : null,
            }
          : undefined,
        death: hasDeath
          ? {
              date: (r.child_death_date as string) ?? null,
              place: (r.child_death_place as string) ?? null,
              year: r.child_death_year != null ? Number(r.child_death_year) : null,
              month: r.child_death_month != null ? Number(r.child_death_month) : null,
              day: r.child_death_day != null ? Number(r.child_death_day) : null,
            }
          : undefined,
      });
    }
  }
  const familiesAsSpouse = Array.from(spouseFamilyByKey.values());
  const spouseByFamilyId = new Map(familiesAsSpouse.map((f) => [f.family.id, f.spouse]));

  const spouseFamilyIds = [...new Set(famSpouseRows.map((r: Row) => r.family_id).filter(Boolean) as string[])];
  const familyEventRows: Row[] =
    spouseFamilyIds.length > 0
      ? await prisma.$queryRaw<Row[]>(
          Prisma.sql`
              SELECT fe.family_id, e.id AS event_id, e.event_type, e.custom_type, e.value, e.cause, e.sort_order,
                     d.original AS date_original, d.year, d.month, d.day,
                     p.original AS place_original, p.name AS place_name
              FROM gedcom_family_events_v2 fe
              JOIN gedcom_events_v2 e ON e.id = fe.event_id AND e.file_uuid = fe.file_uuid
              LEFT JOIN gedcom_dates_v2 d ON d.id = e.date_id
              LEFT JOIN gedcom_places_v2 p ON p.id = e.place_id
              WHERE fe.file_uuid = ${fileUuid}::uuid
                AND fe.family_id IN (${Prisma.join(
                  spouseFamilyIds.map((id) => Prisma.sql`${id}::uuid`),
                  ", ",
                )})
              ORDER BY fe.family_id, e.sort_order
            `,
        )
      : [];

  const eventItem = (
    r: Row,
    source: string,
    opts?: {
      familyId?: string;
      childXref?: string;
      childName?: string | null;
      childIndividualId?: string | null;
      spouseName?: string | null;
      spouseXref?: string;
      spouseIndividualId?: string | null;
    },
  ): IndividualDetailEvent => ({
    eventId: eventRowGedcomId(r),
    eventType: r.event_type as string,
    customType: (r.custom_type as string) ?? null,
    value: (r.value as string) ?? null,
    cause: (r.cause as string) ?? null,
    dateOriginal: (r.date_original as string) ?? null,
    year: r.year != null ? Number(r.year) : null,
    month: r.month != null ? Number(r.month) : null,
    day: r.day != null ? Number(r.day) : null,
    placeOriginal: (r.place_original as string) ?? null,
    placeName: (r.place_name as string) ?? null,
    sortOrder: (r.sort_order as number) ?? 0,
    source,
    familyId: opts?.familyId ?? null,
    childXref: opts?.childXref ?? null,
    childName: opts?.childName ?? null,
    childIndividualId: opts?.childIndividualId ?? null,
    spouseName: opts?.spouseName ?? null,
    spouseXref: opts?.spouseXref ?? null,
    spouseIndividualId: opts?.spouseIndividualId ?? null,
  });

  const events: IndividualDetailEvent[] = [];
  for (const r of indEventRows) {
    events.push(eventItem(r, "individual"));
  }
  for (const r of familyEventRows) {
    const familyId = r.family_id as string;
    const spouse = spouseByFamilyId.get(familyId);
    events.push(
      eventItem(r, "family", {
        familyId,
        spouseName: spouse?.name ?? null,
        spouseXref: spouse?.xref ?? "",
        spouseIndividualId: spouse?.id ?? null,
      }),
    );
  }
  for (const fam of familiesAsSpouse) {
    if (
      fam.spouse.death?.date ||
      fam.spouse.death?.place ||
      fam.spouse.death?.year != null ||
      fam.spouse.death?.month != null ||
      fam.spouse.death?.day != null
    ) {
      events.push(
        eventItem(
          {
            event_type: "DEAT",
            date_original: fam.spouse.death.date,
            place_original: fam.spouse.death.place,
            place_name: fam.spouse.death.place,
            year: fam.spouse.death.year ?? undefined,
            month: fam.spouse.death.month ?? undefined,
            day: fam.spouse.death.day ?? undefined,
            sort_order: 0,
          } as Row,
          "spouseDeath",
          {
            familyId: fam.family.id,
            spouseName: fam.spouse.name ?? null,
            spouseXref: fam.spouse.xref,
            spouseIndividualId: fam.spouse.id || null,
          },
        ),
      );
    }
    for (const ch of fam.children) {
      if (ch.birth?.date || ch.birth?.place || ch.birth?.year != null || ch.birth?.month != null || ch.birth?.day != null) {
        events.push(
          eventItem(
            {
              event_type: "BIRT",
              date_original: ch.birth.date,
              place_original: ch.birth.place,
              place_name: ch.birth.place,
              year: ch.birth.year ?? undefined,
              month: ch.birth.month ?? undefined,
              day: ch.birth.day ?? undefined,
              sort_order: 0,
            } as Row,
            "childBirth",
            {
              familyId: fam.family.id,
              childXref: ch.xref,
              childName: ch.name ?? null,
              childIndividualId: ch.id || null,
            },
          ),
        );
      }
      if (ch.death?.date || ch.death?.place || ch.death?.year != null || ch.death?.month != null || ch.death?.day != null) {
        events.push(
          eventItem(
            {
              event_type: "DEAT",
              date_original: ch.death.date,
              place_original: ch.death.place,
              place_name: ch.death.place,
              year: ch.death.year ?? undefined,
              month: ch.death.month ?? undefined,
              day: ch.death.day ?? undefined,
              sort_order: 0,
            } as Row,
            "childDeath",
            {
              familyId: fam.family.id,
              childXref: ch.xref,
              childName: ch.name ?? null,
              childIndividualId: ch.id || null,
            },
          ),
        );
      }
    }
  }

  const childIds = [...new Set(familiesAsSpouse.flatMap((f) => f.children.map((c) => c.id)).filter(Boolean))] as string[];
  const childMarriageRows: Row[] =
    childIds.length > 0
      ? await prisma.$queryRaw<Row[]>(
          Prisma.sql`
              SELECT f.id AS family_id, f.husband_id, f.wife_id,
                     d.original AS date_original, d.year, d.month, d.day,
                     p.original AS place_original, p.name AS place_name,
                     husb.xref AS husband_xref, husb.full_name AS husband_name,
                     wife.xref AS wife_xref, wife.full_name AS wife_name
              FROM gedcom_families_v2 f
              JOIN gedcom_family_events_v2 fe ON fe.family_id = f.id AND fe.file_uuid = f.file_uuid
              JOIN gedcom_events_v2 e ON e.id = fe.event_id AND e.file_uuid = fe.file_uuid AND e.event_type = 'MARR'
              LEFT JOIN gedcom_dates_v2 d ON d.id = e.date_id
              LEFT JOIN gedcom_places_v2 p ON p.id = e.place_id
              LEFT JOIN gedcom_individuals_v2 husb ON husb.id = f.husband_id
              LEFT JOIN gedcom_individuals_v2 wife ON wife.id = f.wife_id
              WHERE f.file_uuid = ${fileUuid}::uuid
                AND (f.husband_id IN (${Prisma.join(childIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
                     OR f.wife_id IN (${Prisma.join(childIds.map((id) => Prisma.sql`${id}::uuid`), ", ")}))
            `,
        )
      : [];
  const childIdSet = new Set(childIds);
  for (const r of childMarriageRows) {
    const husbandId = r.husband_id as string;
    const wifeId = r.wife_id as string;
    const isChildHusband = childIdSet.has(husbandId);
    const isChildWife = childIdSet.has(wifeId);
    const childXref = (isChildHusband ? r.husband_xref : r.wife_xref) as string;
    const childName = stripName((isChildHusband ? r.husband_name : r.wife_name) as string);
    const spouseXref = (isChildHusband ? r.wife_xref : r.husband_xref) as string;
    const spouseName = stripName((isChildHusband ? r.wife_name : r.husband_name) as string);
    events.push(
      eventItem(
        {
          event_type: "MARR",
          date_original: r.date_original ?? null,
          place_original: r.place_original ?? null,
          place_name: r.place_name ?? null,
          year: r.year ?? undefined,
          month: r.month ?? undefined,
          day: r.day ?? undefined,
          sort_order: 0,
        } as Row,
        "childMarriage",
        {
          familyId: r.family_id as string,
          childXref,
          childName,
          childIndividualId: isChildHusband ? husbandId : wifeId,
          spouseXref,
          spouseName,
          spouseIndividualId: isChildHusband ? wifeId : husbandId,
        },
      ),
    );
  }

  const grandchildBirthRows: Row[] =
    childIds.length > 0
      ? await prisma.$queryRaw<Row[]>(
          Prisma.sql`
              SELECT f.id AS family_id, ch.id AS grandchild_id, ch.xref AS grandchild_xref, ch.full_name AS grandchild_name,
                     ch.birth_date_display AS grandchild_birth_date, ch.birth_place_display AS grandchild_birth_place,
                     ch_birth_d.year AS grandchild_birth_year, ch_birth_d.month AS grandchild_birth_month, ch_birth_d.day AS grandchild_birth_day
              FROM gedcom_families_v2 f
              JOIN gedcom_family_children_v2 fch ON fch.family_id = f.id AND fch.file_uuid = f.file_uuid
              JOIN gedcom_individuals_v2 ch ON ch.id = fch.child_id
              LEFT JOIN gedcom_dates_v2 ch_birth_d ON ch_birth_d.id = ch.birth_date_id
              WHERE f.file_uuid = ${fileUuid}::uuid
                AND (f.husband_id IN (${Prisma.join(childIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
                     OR f.wife_id IN (${Prisma.join(childIds.map((id) => Prisma.sql`${id}::uuid`), ", ")}))
            `,
        )
      : [];
  for (const r of grandchildBirthRows) {
    const hasBirth =
      r.grandchild_birth_date != null ||
      r.grandchild_birth_place != null ||
      r.grandchild_birth_year != null ||
      r.grandchild_birth_month != null ||
      r.grandchild_birth_day != null;
    if (hasBirth) {
      events.push(
        eventItem(
          {
            event_type: "BIRT",
            date_original: r.grandchild_birth_date ?? null,
            place_original: r.grandchild_birth_place ?? null,
            place_name: r.grandchild_birth_place ?? null,
            year: r.grandchild_birth_year ?? undefined,
            month: r.grandchild_birth_month ?? undefined,
            day: r.grandchild_birth_day ?? undefined,
            sort_order: 0,
          } as Row,
          "grandchildBirth",
          {
            familyId: r.family_id as string,
            childXref: (r.grandchild_xref as string) ?? "",
            childName: stripName(r.grandchild_name as string),
            childIndividualId: (r.grandchild_id as string) ?? null,
          },
        ),
      );
    }
  }

  const famAsChildRows = await prisma.$queryRaw<Row[]>(
    Prisma.sql`
        SELECT fch.family_id
        FROM gedcom_family_children_v2 fch
        WHERE fch.file_uuid = ${fileUuid}::uuid AND fch.child_id = ${personId}::uuid
      `,
  );
  const originFamilyIds = [...new Set(famAsChildRows.map((r: Row) => r.family_id).filter(Boolean) as string[])];

  if (originFamilyIds.length > 0) {
    const parentDeathRows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
          SELECT f.id AS family_id,
                 husb.id AS father_id, husb.xref AS father_xref, husb.full_name AS father_name,
                 husb.death_date_display AS father_death_date, husb.death_place_display AS father_death_place,
                 husb_death_d.year AS father_death_year, husb_death_d.month AS father_death_month, husb_death_d.day AS father_death_day,
                 wife.id AS mother_id, wife.xref AS mother_xref, wife.full_name AS mother_name,
                 wife.death_date_display AS mother_death_date, wife.death_place_display AS mother_death_place,
                 wife_death_d.year AS mother_death_year, wife_death_d.month AS mother_death_month, wife_death_d.day AS mother_death_day
          FROM gedcom_families_v2 f
          LEFT JOIN gedcom_individuals_v2 husb ON husb.id = f.husband_id
          LEFT JOIN gedcom_dates_v2 husb_death_d ON husb_death_d.id = husb.death_date_id
          LEFT JOIN gedcom_individuals_v2 wife ON wife.id = f.wife_id
          LEFT JOIN gedcom_dates_v2 wife_death_d ON wife_death_d.id = wife.death_date_id
          WHERE f.file_uuid = ${fileUuid}::uuid
            AND f.id IN (${Prisma.join(originFamilyIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
        `,
    );
    for (const r of parentDeathRows) {
      const hasFatherDeath =
        r.father_death_date != null ||
        r.father_death_place != null ||
        r.father_death_year != null ||
        r.father_death_month != null ||
        r.father_death_day != null;
      if (hasFatherDeath) {
        events.push(
          eventItem(
            {
              event_type: "DEAT",
              date_original: r.father_death_date ?? null,
              place_original: r.father_death_place ?? null,
              place_name: r.father_death_place ?? null,
              year: r.father_death_year ?? undefined,
              month: r.father_death_month ?? undefined,
              day: r.father_death_day ?? undefined,
              sort_order: 0,
            } as Row,
            "parentDeath",
            {
              familyId: r.family_id as string,
              spouseName: stripName(r.father_name as string),
              spouseXref: (r.father_xref as string) ?? "",
              spouseIndividualId: (r.father_id as string) ?? null,
            },
          ),
        );
      }
      const hasMotherDeath =
        r.mother_death_date != null ||
        r.mother_death_place != null ||
        r.mother_death_year != null ||
        r.mother_death_month != null ||
        r.mother_death_day != null;
      if (hasMotherDeath) {
        events.push(
          eventItem(
            {
              event_type: "DEAT",
              date_original: r.mother_death_date ?? null,
              place_original: r.mother_death_place ?? null,
              place_name: r.mother_death_place ?? null,
              year: r.mother_death_year ?? undefined,
              month: r.mother_death_month ?? undefined,
              day: r.mother_death_day ?? undefined,
              sort_order: 0,
            } as Row,
            "parentDeath",
            {
              familyId: r.family_id as string,
              spouseName: stripName(r.mother_name as string),
              spouseXref: (r.mother_xref as string) ?? "",
              spouseIndividualId: (r.mother_id as string) ?? null,
            },
          ),
        );
      }
    }

    const siblingDeathRows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
          SELECT fch.family_id, ch.id AS sibling_id, ch.xref AS sibling_xref, ch.full_name AS sibling_name,
                 ch.death_date_display AS sibling_death_date, ch.death_place_display AS sibling_death_place,
                 sibling_death_d.year AS sibling_death_year, sibling_death_d.month AS sibling_death_month, sibling_death_d.day AS sibling_death_day
          FROM gedcom_family_children_v2 fch
          JOIN gedcom_individuals_v2 ch ON ch.id = fch.child_id
          LEFT JOIN gedcom_dates_v2 sibling_death_d ON sibling_death_d.id = ch.death_date_id
          WHERE fch.file_uuid = ${fileUuid}::uuid
            AND fch.family_id IN (${Prisma.join(originFamilyIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
            AND fch.child_id != ${personId}::uuid
        `,
    );
    for (const r of siblingDeathRows) {
      const hasDeath =
        r.sibling_death_date != null ||
        r.sibling_death_place != null ||
        r.sibling_death_year != null ||
        r.sibling_death_month != null ||
        r.sibling_death_day != null;
      if (hasDeath) {
        events.push(
          eventItem(
            {
              event_type: "DEAT",
              date_original: r.sibling_death_date ?? null,
              place_original: r.sibling_death_place ?? null,
              place_name: r.sibling_death_place ?? null,
              year: r.sibling_death_year ?? undefined,
              month: r.sibling_death_month ?? undefined,
              day: r.sibling_death_day ?? undefined,
              sort_order: 0,
            } as Row,
            "siblingDeath",
            {
              familyId: r.family_id as string,
              childXref: (r.sibling_xref as string) ?? "",
              childName: stripName(r.sibling_name as string),
              childIndividualId: (r.sibling_id as string) ?? null,
            },
          ),
        );
      }
    }

    const parentIdRows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
          SELECT f.husband_id, f.wife_id
          FROM gedcom_families_v2 f
          WHERE f.file_uuid = ${fileUuid}::uuid
            AND f.id IN (${Prisma.join(originFamilyIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
        `,
    );
    const parentIdSet = new Set<string>();
    for (const r of parentIdRows) {
      if (r.husband_id) parentIdSet.add(r.husband_id as string);
      if (r.wife_id) parentIdSet.add(r.wife_id as string);
    }
    const parentIds = Array.from(parentIdSet);

    if (parentIds.length > 0) {
      const grandparentFamRows = await prisma.$queryRaw<Row[]>(
        Prisma.sql`
            SELECT fch.family_id
            FROM gedcom_family_children_v2 fch
            WHERE fch.file_uuid = ${fileUuid}::uuid
              AND fch.child_id IN (${Prisma.join(parentIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
          `,
      );
      const grandparentFamilyIds = [...new Set(grandparentFamRows.map((r: Row) => r.family_id).filter(Boolean) as string[])];

      if (grandparentFamilyIds.length > 0) {
        const grandparentDeathRows = await prisma.$queryRaw<Row[]>(
          Prisma.sql`
              SELECT f.id AS family_id,
                     husb.id AS grandfather_id, husb.xref AS grandfather_xref, husb.full_name AS grandfather_name,
                     husb.death_date_display AS grandfather_death_date, husb.death_place_display AS grandfather_death_place,
                     husb_death_d.year AS grandfather_death_year, husb_death_d.month AS grandfather_death_month, husb_death_d.day AS grandfather_death_day,
                     wife.id AS grandmother_id, wife.xref AS grandmother_xref, wife.full_name AS grandmother_name,
                     wife.death_date_display AS grandmother_death_date, wife.death_place_display AS grandmother_death_place,
                     wife_death_d.year AS grandmother_death_year, wife_death_d.month AS grandmother_death_month, wife_death_d.day AS grandmother_death_day
              FROM gedcom_families_v2 f
              LEFT JOIN gedcom_individuals_v2 husb ON husb.id = f.husband_id
              LEFT JOIN gedcom_dates_v2 husb_death_d ON husb_death_d.id = husb.death_date_id
              LEFT JOIN gedcom_individuals_v2 wife ON wife.id = f.wife_id
              LEFT JOIN gedcom_dates_v2 wife_death_d ON wife_death_d.id = wife.death_date_id
              WHERE f.file_uuid = ${fileUuid}::uuid
                AND f.id IN (${Prisma.join(grandparentFamilyIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
            `,
        );
        for (const r of grandparentDeathRows) {
          const hasGrandfatherDeath =
            r.grandfather_death_date != null ||
            r.grandfather_death_place != null ||
            r.grandfather_death_year != null ||
            r.grandfather_death_month != null ||
            r.grandfather_death_day != null;
          if (hasGrandfatherDeath) {
            events.push(
              eventItem(
                {
                  event_type: "DEAT",
                  date_original: r.grandfather_death_date ?? null,
                  place_original: r.grandfather_death_place ?? null,
                  place_name: r.grandfather_death_place ?? null,
                  year: r.grandfather_death_year ?? undefined,
                  month: r.grandfather_death_month ?? undefined,
                  day: r.grandfather_death_day ?? undefined,
                  sort_order: 0,
                } as Row,
                "grandparentDeath",
                {
                  familyId: r.family_id as string,
                  spouseName: stripName(r.grandfather_name as string),
                  spouseXref: (r.grandfather_xref as string) ?? "",
                  spouseIndividualId: (r.grandfather_id as string) ?? null,
                },
              ),
            );
          }
          const hasGrandmotherDeath =
            r.grandmother_death_date != null ||
            r.grandmother_death_place != null ||
            r.grandmother_death_year != null ||
            r.grandmother_death_month != null ||
            r.grandmother_death_day != null;
          if (hasGrandmotherDeath) {
            events.push(
              eventItem(
                {
                  event_type: "DEAT",
                  date_original: r.grandmother_death_date ?? null,
                  place_original: r.grandmother_death_place ?? null,
                  place_name: r.grandmother_death_place ?? null,
                  year: r.grandmother_death_year ?? undefined,
                  month: r.grandmother_death_month ?? undefined,
                  day: r.grandmother_death_day ?? undefined,
                  sort_order: 0,
                } as Row,
                "grandparentDeath",
                {
                  familyId: r.family_id as string,
                  spouseName: stripName(r.grandmother_name as string),
                  spouseXref: (r.grandmother_xref as string) ?? "",
                  spouseIndividualId: (r.grandmother_id as string) ?? null,
                },
              ),
            );
          }
        }
      }
    }
  }

  events.sort((a, b) => {
    const yA = Number(a.year ?? Infinity);
    const yB = Number(b.year ?? Infinity);
    if (yA !== yB) return yA - yB;
    const mA = Number(a.month ?? 13);
    const mB = Number(b.month ?? 13);
    if (mA !== mB) return mA - mB;
    const dA = Number(a.day ?? 32);
    const dB = Number(b.day ?? 32);
    if (dA !== dB) return dA - dB;
    return Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
  });

  return { events };
}
