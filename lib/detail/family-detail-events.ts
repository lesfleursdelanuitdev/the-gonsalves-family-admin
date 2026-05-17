/**
 * Aggregates events for the admin family detail view:
 * events on the family record plus each member's own individual events.
 */
import { Prisma } from "@ligneous/prisma";
import type { PrismaClient } from "@ligneous/prisma";
import { eventRowGedcomId, type FamilyDetailEvent } from "@ligneous/gedcom-events";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import type { IndividualDetailEvent } from "@ligneous/gedcom-events";
import { dedupeTimelineEvents } from "@/lib/detail/timeline-event-dedupe";
import { grandchildParentFromFamilyRow } from "@/lib/detail/grandchild-parent-from-family-row";
import { attachTimelineEventPreviewMedia } from "@/lib/detail/timeline-event-preview-media";
import { mergeFamilyChildrenForApi } from "@/lib/admin/admin-family-children-merge";
import type { TimelineSubject } from "@ligneous/gedcom-events";

export type { FamilyDetailEvent } from "@ligneous/gedcom-events";

type Row = Record<string, unknown>;

function stripName(s: string | null | undefined): string | null {
  const t = stripSlashesFromName(s);
  return t === "" ? null : t;
}

function eventItem(
  r: Row,
  source: string,
  opts?: {
    familyId?: string;
    memberId?: string | null;
    memberName?: string | null;
    spouseName?: string | null;
    spouseXref?: string | null;
    spouseIndividualId?: string | null;
    childXref?: string | null;
    childName?: string | null;
    childIndividualId?: string | null;
    husbandIndividualId?: string | null;
    wifeIndividualId?: string | null;
    husbandDisplayName?: string | null;
    wifeDisplayName?: string | null;
    memberRole?: "husband" | "wife" | "child" | null;
    relatedSex?: string | null;
    relatedParentName?: string | null;
    relatedParentSex?: string | null;
  },
): FamilyDetailEvent {
  return {
    eventId: eventRowGedcomId(r),
    eventType: r.event_type as string,
    customType: (r.custom_type as string) ?? null,
    eventLabel: (r.event_label as string | null | undefined) ?? null,
    value: (r.value as string) ?? null,
    cause: (r.cause as string) ?? null,
    dateOriginal: (r.date_original as string) ?? null,
    dateType: (r.date_type as string | null | undefined) ?? null,
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
    husbandIndividualId: opts?.husbandIndividualId ?? null,
    wifeIndividualId: opts?.wifeIndividualId ?? null,
    memberId: opts?.memberId ?? null,
    memberName: opts?.memberName ?? null,
    husbandDisplayName: opts?.husbandDisplayName ?? null,
    wifeDisplayName: opts?.wifeDisplayName ?? null,
    memberRole: opts?.memberRole ?? null,
    relatedSex: opts?.relatedSex ?? null,
    relatedParentName: opts?.relatedParentName ?? null,
    relatedParentSex: opts?.relatedParentSex ?? null,
  };
}

export async function buildFamilyDetailEvents(
  prisma: PrismaClient,
  fileUuid: string,
  familyId: string,
): Promise<{ events: FamilyDetailEvent[]; timelineSubject: TimelineSubject }> {
  const fam = await prisma.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: {
      id: true,
      husbandId: true,
      wifeId: true,
      marriageDateDisplay: true,
      marriagePlaceDisplay: true,
      marriageYear: true,
      husband: { select: { id: true, xref: true, fullName: true, sex: true } },
      wife: { select: { id: true, xref: true, fullName: true, sex: true } },
      familyChildren: {
        include: {
          child: { select: { id: true, xref: true, fullName: true, sex: true, birthYear: true } },
        },
        orderBy: { birthOrder: "asc" },
      },
      parentChildRels: {
        select: { childId: true },
      },
    },
  });

  if (!fam) {
    return {
      events: [],
      timelineSubject: { kind: "family", husbandName: null, wifeName: null, husbandSex: null, wifeSex: null },
    };
  }

  const mergedChildren = await mergeFamilyChildrenForApi(prisma, fileUuid, fam);

  const husbandDisplayName = fam.husband
    ? stripName(fam.husband.fullName) ?? fam.husband.xref ?? null
    : null;
  const wifeDisplayName = fam.wife
    ? stripName(fam.wife.fullName) ?? fam.wife.xref ?? null
    : null;

  const timelineSubject: TimelineSubject = {
    kind: "family",
    husbandName: husbandDisplayName,
    wifeName: wifeDisplayName,
    husbandSex: fam.husband?.sex != null && String(fam.husband.sex).trim() !== "" ? String(fam.husband.sex) : null,
    wifeSex: fam.wife?.sex != null && String(fam.wife.sex).trim() !== "" ? String(fam.wife.sex) : null,
  };

  const familyEventRows = await prisma.$queryRaw<Row[]>(
    Prisma.sql`
      SELECT fe.family_id, e.id AS event_id, e.event_type, e.custom_type, e.value, e.cause, e.sort_order,
             e.event_label AS event_label,
             d.original AS date_original, d.date_type AS date_type, d.year, d.month, d.day,
             p.original AS place_original, p.name AS place_name
      FROM gedcom_family_events_v2 fe
      JOIN gedcom_events_v2 e ON e.id = fe.event_id AND e.file_uuid = fe.file_uuid
      LEFT JOIN gedcom_dates_v2 d ON d.id = e.date_id
      LEFT JOIN gedcom_places_v2 p ON p.id = e.place_id
      WHERE fe.file_uuid = ${fileUuid}::uuid AND fe.family_id = ${familyId}::uuid
      ORDER BY e.sort_order ASC, e.event_type
    `,
  );

  type Member = { id: string; name: string | null; role: "husband" | "wife" | "child"; sex: string | null };
  const members: Member[] = [];
  if (fam.husband) {
    members.push({
      id: fam.husband.id,
      name: stripName(fam.husband.fullName) ?? fam.husband.xref ?? null,
      role: "husband",
      sex: fam.husband.sex != null && String(fam.husband.sex).trim() !== "" ? String(fam.husband.sex) : null,
    });
  }
  if (fam.wife) {
    members.push({
      id: fam.wife.id,
      name: stripName(fam.wife.fullName) ?? fam.wife.xref ?? null,
      role: "wife",
      sex: fam.wife.sex != null && String(fam.wife.sex).trim() !== "" ? String(fam.wife.sex) : null,
    });
  }
  for (const fc of mergedChildren) {
    const ch = fc.child;
    if (!ch?.id) continue;
    if (members.some((m) => m.id === ch.id)) continue;
    members.push({
      id: ch.id,
      name: stripName(ch.fullName) ?? ch.xref ?? null,
      role: "child",
      sex: ch.sex != null && String(ch.sex).trim() !== "" ? String(ch.sex) : null,
    });
  }

  const events: FamilyDetailEvent[] = [];

  for (const r of familyEventRows) {
    events.push(
      eventItem(r, "familyRecord", {
        familyId,
        husbandIndividualId: fam.husbandId,
        wifeIndividualId: fam.wifeId,
        husbandDisplayName,
        wifeDisplayName,
      }),
    );
  }

  const hasMarrRow = familyEventRows.some(
    (r) => String(r.event_type ?? "").toUpperCase() === "MARR",
  );
  if (
    !hasMarrRow &&
    (fam.marriageDateDisplay?.trim() || fam.marriageYear != null)
  ) {
    events.push(
      eventItem(
        {
          event_type: "MARR",
          event_label: null,
          custom_type: null,
          value: null,
          cause: null,
          date_original: fam.marriageDateDisplay ?? null,
          year: fam.marriageYear ?? null,
          month: null,
          day: null,
          place_original: fam.marriagePlaceDisplay ?? null,
          place_name: fam.marriagePlaceDisplay ?? null,
          sort_order: 0,
        },
        "familyRecord",
        {
          familyId,
          husbandIndividualId: fam.husbandId,
          wifeIndividualId: fam.wifeId,
          husbandDisplayName,
          wifeDisplayName,
        },
      ),
    );
  }

  for (const m of members) {
    const indEventRows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
        SELECT e.id AS event_id, e.event_type, e.custom_type, e.value, e.cause, e.sort_order,
               e.event_label AS event_label,
               d.original AS date_original, d.date_type AS date_type, d.year, d.month, d.day,
               p.original AS place_original, p.name AS place_name
        FROM gedcom_individual_events_v2 ie
        JOIN gedcom_events_v2 e ON e.id = ie.event_id AND e.file_uuid = ie.file_uuid
        LEFT JOIN gedcom_dates_v2 d ON d.id = e.date_id
        LEFT JOIN gedcom_places_v2 p ON p.id = e.place_id
        WHERE ie.file_uuid = ${fileUuid}::uuid AND ie.individual_id = ${m.id}::uuid
        ORDER BY e.sort_order ASC, e.event_type
      `,
    );
    for (const r of indEventRows) {
      events.push(
        eventItem(r, "member", {
          familyId,
          memberId: m.id,
          memberName: m.name,
          memberRole: m.role,
          relatedSex: m.sex,
        }),
      );
    }
  }

  const childIdsForGrand = mergedChildren.map((fc) => fc.child?.id).filter(Boolean) as string[];
  const childIdSetForGrand = new Set(childIdsForGrand);
  if (childIdsForGrand.length > 0) {
    const grandchildBirthRows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
        SELECT f.id AS family_id, f.husband_id AS rp_husband_id, f.wife_id AS rp_wife_id,
               rh.full_name AS rp_husband_name, rh.sex AS rp_husband_sex,
               rw.full_name AS rp_wife_name, rw.sex AS rp_wife_sex,
               ch.id AS grandchild_id, ch.xref AS grandchild_xref, ch.full_name AS grandchild_name,
               ch.sex AS grandchild_sex,
               ch.birth_date_display AS grandchild_birth_date, ch.birth_place_display AS grandchild_birth_place,
               ch_birth_d.year AS grandchild_birth_year, ch_birth_d.month AS grandchild_birth_month, ch_birth_d.day AS grandchild_birth_day,
               ch_birth_d.date_type AS grandchild_birth_date_type
        FROM gedcom_families_v2 f
        JOIN gedcom_family_children_v2 fch ON fch.family_id = f.id AND fch.file_uuid = f.file_uuid
        JOIN gedcom_individuals_v2 ch ON ch.id = fch.child_id
        LEFT JOIN gedcom_individuals_v2 rh ON rh.id = f.husband_id
        LEFT JOIN gedcom_individuals_v2 rw ON rw.id = f.wife_id
        LEFT JOIN gedcom_dates_v2 ch_birth_d ON ch_birth_d.id = ch.birth_date_id
        WHERE f.file_uuid = ${fileUuid}::uuid
          AND (f.husband_id IN (${Prisma.join(childIdsForGrand.map((id) => Prisma.sql`${id}::uuid`), ", ")})
               OR f.wife_id IN (${Prisma.join(childIdsForGrand.map((id) => Prisma.sql`${id}::uuid`), ", ")}))
      `,
    );
    for (const r of grandchildBirthRows) {
      const hasBirth =
        r.grandchild_birth_date != null ||
        r.grandchild_birth_place != null ||
        r.grandchild_birth_year != null ||
        r.grandchild_birth_month != null ||
        r.grandchild_birth_day != null;
      if (hasBirth) {
        const par = grandchildParentFromFamilyRow(r, childIdSetForGrand);
        events.push(
          eventItem(
            {
              event_type: "BIRT",
              date_original: r.grandchild_birth_date ?? null,
              date_type: r.grandchild_birth_date_type ?? null,
              place_original: r.grandchild_birth_place ?? null,
              place_name: r.grandchild_birth_place ?? null,
              year: r.grandchild_birth_year ?? undefined,
              month: r.grandchild_birth_month ?? undefined,
              day: r.grandchild_birth_day ?? undefined,
              sort_order: 0,
            } as Row,
            "grandchildOfChild",
            {
              familyId,
              childXref: (r.grandchild_xref as string) ?? "",
              childName: stripName(r.grandchild_name as string),
              childIndividualId: (r.grandchild_id as string) ?? null,
              relatedSex:
                r.grandchild_sex != null && String(r.grandchild_sex).trim() !== "" ? String(r.grandchild_sex) : null,
              relatedParentName: par.name,
              relatedParentSex: par.sex,
            },
          ),
        );
      }
    }

    const grandchildDeathRows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
        SELECT f.id AS family_id, f.husband_id AS rp_husband_id, f.wife_id AS rp_wife_id,
               rh.full_name AS rp_husband_name, rh.sex AS rp_husband_sex,
               rw.full_name AS rp_wife_name, rw.sex AS rp_wife_sex,
               ch.id AS grandchild_id, ch.xref AS grandchild_xref, ch.full_name AS grandchild_name,
               ch.sex AS grandchild_sex,
               ch.death_date_display AS grandchild_death_date, ch.death_place_display AS grandchild_death_place,
               ch_death_d.year AS grandchild_death_year, ch_death_d.month AS grandchild_death_month, ch_death_d.day AS grandchild_death_day,
               ch_death_d.date_type AS grandchild_death_date_type
        FROM gedcom_families_v2 f
        JOIN gedcom_family_children_v2 fch ON fch.family_id = f.id AND fch.file_uuid = f.file_uuid
        JOIN gedcom_individuals_v2 ch ON ch.id = fch.child_id
        LEFT JOIN gedcom_individuals_v2 rh ON rh.id = f.husband_id
        LEFT JOIN gedcom_individuals_v2 rw ON rw.id = f.wife_id
        LEFT JOIN gedcom_dates_v2 ch_death_d ON ch_death_d.id = ch.death_date_id
        WHERE f.file_uuid = ${fileUuid}::uuid
          AND (f.husband_id IN (${Prisma.join(childIdsForGrand.map((id) => Prisma.sql`${id}::uuid`), ", ")})
               OR f.wife_id IN (${Prisma.join(childIdsForGrand.map((id) => Prisma.sql`${id}::uuid`), ", ")}))
      `,
    );
    for (const r of grandchildDeathRows) {
      const hasDeath =
        r.grandchild_death_date != null ||
        r.grandchild_death_place != null ||
        r.grandchild_death_year != null ||
        r.grandchild_death_month != null ||
        r.grandchild_death_day != null;
      if (hasDeath) {
        const par = grandchildParentFromFamilyRow(r, childIdSetForGrand);
        events.push(
          eventItem(
            {
              event_type: "DEAT",
              date_original: r.grandchild_death_date ?? null,
              date_type: r.grandchild_death_date_type ?? null,
              place_original: r.grandchild_death_place ?? null,
              place_name: r.grandchild_death_place ?? null,
              year: r.grandchild_death_year ?? undefined,
              month: r.grandchild_death_month ?? undefined,
              day: r.grandchild_death_day ?? undefined,
              sort_order: 0,
            } as Row,
            "grandchildOfChild",
            {
              familyId,
              childXref: (r.grandchild_xref as string) ?? "",
              childName: stripName(r.grandchild_name as string),
              childIndividualId: (r.grandchild_id as string) ?? null,
              relatedSex:
                r.grandchild_sex != null && String(r.grandchild_sex).trim() !== "" ? String(r.grandchild_sex) : null,
              relatedParentName: par.name,
              relatedParentSex: par.sex,
            },
          ),
        );
      }
    }
  }

  const deduped = dedupeTimelineEvents(events);

  deduped.sort((a, b) => {
    const yA = Number(a.year ?? Infinity);
    const yB = Number(b.year ?? Infinity);
    if (yA !== yB) return yA - yB;
    const mA = Number(a.month ?? 13);
    const mB = Number(b.month ?? 13);
    if (mA !== mB) return mA - mB;
    const dA = Number(a.day ?? 32);
    const dB = Number(b.day ?? 32);
    if (dA !== dB) return dA - dB;
    const srcOrder = (s: string) => (s === "familyRecord" ? 0 : 1);
    const so = srcOrder(a.source) - srcOrder(b.source);
    if (so !== 0) return so;
    return Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
  });

  await attachTimelineEventPreviewMedia(prisma, fileUuid, deduped, { mode: "family" });

  return { events: deduped, timelineSubject };
}
