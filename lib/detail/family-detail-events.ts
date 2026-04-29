/**
 * Aggregates events for the admin family detail view:
 * events on the family record plus each member's own individual events.
 */
import { Prisma } from "@ligneous/prisma";
import type { PrismaClient } from "@ligneous/prisma";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { eventRowGedcomId, type IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { mergeFamilyChildrenForApi } from "@/lib/admin/admin-family-children-merge";

export type FamilyDetailEvent = IndividualDetailEvent & {
  memberId?: string | null;
  memberName?: string | null;
  husbandDisplayName?: string | null;
  wifeDisplayName?: string | null;
};

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
  },
): FamilyDetailEvent {
  return {
    eventId: eventRowGedcomId(r),
    eventType: r.event_type as string,
    customType: (r.custom_type as string) ?? null,
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
  };
}

export async function buildFamilyDetailEvents(
  prisma: PrismaClient,
  fileUuid: string,
  familyId: string,
): Promise<{ events: FamilyDetailEvent[] }> {
  const fam = await prisma.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: {
      id: true,
      husbandId: true,
      wifeId: true,
      marriageDateDisplay: true,
      marriagePlaceDisplay: true,
      marriageYear: true,
      husband: { select: { id: true, xref: true, fullName: true } },
      wife: { select: { id: true, xref: true, fullName: true } },
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
    return { events: [] };
  }

  const mergedChildren = await mergeFamilyChildrenForApi(prisma, fileUuid, fam);

  const husbandDisplayName = fam.husband
    ? stripName(fam.husband.fullName) ?? fam.husband.xref ?? null
    : null;
  const wifeDisplayName = fam.wife
    ? stripName(fam.wife.fullName) ?? fam.wife.xref ?? null
    : null;

  const familyEventRows = await prisma.$queryRaw<Row[]>(
    Prisma.sql`
      SELECT fe.family_id, e.id AS event_id, e.event_type, e.custom_type, e.value, e.cause, e.sort_order,
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

  type Member = { id: string; name: string | null };
  const members: Member[] = [];
  if (fam.husband) {
    members.push({
      id: fam.husband.id,
      name: stripName(fam.husband.fullName) ?? fam.husband.xref ?? null,
    });
  }
  if (fam.wife) {
    members.push({
      id: fam.wife.id,
      name: stripName(fam.wife.fullName) ?? fam.wife.xref ?? null,
    });
  }
  for (const fc of mergedChildren) {
    const ch = fc.child;
    if (!ch?.id) continue;
    if (members.some((m) => m.id === ch.id)) continue;
    members.push({
      id: ch.id,
      name: stripName(ch.fullName) ?? ch.xref ?? null,
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
        }),
      );
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
    const srcOrder = (s: string) => (s === "familyRecord" ? 0 : 1);
    const so = srcOrder(a.source) - srcOrder(b.source);
    if (so !== 0) return so;
    return Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
  });

  return { events };
}
