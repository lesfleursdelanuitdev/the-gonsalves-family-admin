import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  adminEventsRequiresRawSql,
  buildAdminEventsWhere,
  hasStructuredEventFilters,
  parseLinkTypeParam,
  parseYearParam,
  type AdminEventsStructuredFilters,
} from "@/lib/admin/admin-events-filter";
import { adminEventsRawConditions, adminEventsRawWhereSql } from "@/lib/admin/admin-events-raw-sql";
import {
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
  parseDateInput,
  parseLinkIds,
  parseMediaIds,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import { refreshIndividualKeyFactsDenorm } from "@/lib/admin/admin-individual-key-events";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { refreshFamilyDivorceDenorm, refreshFamilyMarriageDenorm } from "@/lib/admin/admin-family-marriage";

const EVENT_LIST_INCLUDE = {
  date: true,
  place: true,
  individualEvents: {
    include: {
      individual: {
        select: {
          id: true,
          fullName: true,
          individualNameForms: {
            where: { isPrimary: true },
            take: 1,
            select: {
              givenNames: {
                orderBy: { position: "asc" as const },
                select: { givenName: { select: { givenName: true } } },
              },
              surnames: {
                orderBy: { position: "asc" as const },
                select: { surname: { select: { surname: true } } },
              },
            },
          },
        },
      },
    },
  },
  familyEvents: {
    include: {
      family: {
        select: {
          id: true,
          xref: true,
          husband: { select: { id: true, fullName: true } },
          wife: { select: { id: true, fullName: true } },
        },
      },
    },
  },
  eventMedia: {
    include: {
      media: { select: { id: true, xref: true, title: true, fileRef: true } },
    },
  },
} as const;

function parseStructuredFromSearchParams(searchParams: URLSearchParams): AdminEventsStructuredFilters {
  const lg = searchParams.get("linkedGiven")?.trim().toLowerCase() || "";
  const ll = searchParams.get("linkedLast")?.trim() || "";
  const p1g = searchParams.get("p1Given")?.trim().toLowerCase() || "";
  const p1l = searchParams.get("p1Last")?.trim() || "";
  const p2g = searchParams.get("p2Given")?.trim().toLowerCase() || "";
  const p2l = searchParams.get("p2Last")?.trim() || "";
  const fpg = searchParams.get("familyPartnerGiven")?.trim().toLowerCase() || "";
  const fpl = searchParams.get("familyPartnerLast")?.trim() || "";
  return {
    eventType: (searchParams.get("eventType") || searchParams.get("type") || "").trim() || null,
    placeContains: (searchParams.get("placeContains") || "").trim() || null,
    dateYearMin: parseYearParam(searchParams.get("dateYearMin")),
    dateYearMax: parseYearParam(searchParams.get("dateYearMax")),
    linkType: parseLinkTypeParam(searchParams.get("linkType")),
    linkedGiven: lg || null,
    linkedLast: ll || null,
    p1Given: p1g || null,
    p1Last: p1l || null,
    p2Given: p2g || null,
    p2Last: p2l || null,
    familyPartnerGiven: fpg || null,
    familyPartnerLast: fpl || null,
  };
}

async function listEventsFilteredRaw(
  fileUuid: string,
  structured: AdminEventsStructuredFilters,
  q: string | null,
  limit: number,
  offset: number
) {
  const conditions = adminEventsRawConditions(fileUuid, structured, q);
  const whereSql = adminEventsRawWhereSql(conditions);
  const fromWhere = Prisma.sql`
    FROM gedcom_events_v2 e
    WHERE ${whereSql}
  `;

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`SELECT COUNT(*)::bigint AS c ${fromWhere}`),
    prisma.$queryRaw<[{ id: string }]>(
      Prisma.sql`SELECT e.id ${fromWhere} ORDER BY e.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    ),
  ]);

  const countVal = countRows[0]?.c;
  const total = countVal != null ? Number(countVal) : 0;
  const paginatedIds = idRows.map((r) => r.id);
  const events =
    paginatedIds.length === 0
      ? []
      : await prisma.gedcomEvent.findMany({
          where: { id: { in: paginatedIds } },
          include: EVENT_LIST_INCLUDE,
        });
  const order = new Map(paginatedIds.map((id, i) => [id, i]));
  const sorted = events.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { events: sorted, total };
}

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || null;
  const structured = parseStructuredFromSearchParams(searchParams);
  const { limit, offset } = parseListParams(searchParams);

  const useFilteredWhere = hasStructuredEventFilters(structured) || !!q;

  if (useFilteredWhere && adminEventsRequiresRawSql(structured)) {
    const { events, total } = await listEventsFilteredRaw(fileUuid, structured, q, limit, offset);
    return NextResponse.json({
      events,
      total,
      hasMore: offset + events.length < total,
    });
  }

  const where = useFilteredWhere
    ? buildAdminEventsWhere(fileUuid, structured, q)
    : { fileUuid };

  const [events, total] = await Promise.all([
    prisma.gedcomEvent.findMany({
      where,
      include: EVENT_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.gedcomEvent.count({ where }),
  ]);

  return NextResponse.json({
    events,
    total,
    hasMore: offset + events.length < total,
  });
});

export const POST = withAdminAuth(async (req, user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;
  const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
  const customType =
    typeof body.customType === "string" && body.customType.trim() ? body.customType.trim() : null;
  const value = typeof body.value === "string" && body.value.trim() ? body.value.trim() : null;
  const cause = typeof body.cause === "string" && body.cause.trim() ? body.cause.trim() : null;
  const agency = typeof body.agency === "string" && body.agency.trim() ? body.agency.trim() : null;

  if (!eventType) {
    return NextResponse.json({ error: "eventType is required" }, { status: 400 });
  }

  const dateParsed = parseDateInput(body.date);
  let legacyDateOriginal: string | null = null;
  if (!dateParsed && typeof body.dateOriginal === "string" && body.dateOriginal.trim()) {
    legacyDateOriginal = body.dateOriginal.trim();
  }

  const placeParsed = parsePlaceInput(body.place);
  let legacyPlaceOriginal: string | null = null;
  if (!placeParsed && typeof body.placeOriginal === "string" && body.placeOriginal.trim()) {
    legacyPlaceOriginal = body.placeOriginal.trim();
  }

  const { individualIds, familyIds } = parseLinkIds(body);
  const mediaIds = parseMediaIds(body);

  try {
    const event = await prisma.$transaction(async (tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
      let dateId: string | null = null;
      if (dateParsed) {
        dateId = await findOrCreateGedcomDate(tx, fileUuid, dateParsed);
      } else if (legacyDateOriginal) {
        const hash = `legacy-date-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const d = await tx.gedcomDate.create({
          data: {
            fileUuid,
            original: legacyDateOriginal,
            hash,
          },
        });
        dateId = d.id;
      }

      let placeId: string | null = null;
      if (placeParsed) {
        placeId = await findOrCreateGedcomPlace(tx, fileUuid, placeParsed);
      } else if (legacyPlaceOriginal) {
        const hash = `legacy-place-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const p = await tx.gedcomPlace.create({
          data: {
            fileUuid,
            original: legacyPlaceOriginal,
            hash,
          },
        });
        placeId = p.id;
      }

      for (const iid of individualIds) {
        const ok = await tx.gedcomIndividual.findFirst({
          where: { id: iid, fileUuid },
          select: { id: true },
        });
        if (!ok) {
          throw new Error(`INVALID_INDIVIDUAL:${iid}`);
        }
      }
      for (const fid of familyIds) {
        const ok = await tx.gedcomFamily.findFirst({
          where: { id: fid, fileUuid },
          select: { id: true },
        });
        if (!ok) {
          throw new Error(`INVALID_FAMILY:${fid}`);
        }
      }
      for (const mid of mediaIds) {
        const ok = await tx.gedcomMedia.findFirst({
          where: { id: mid, fileUuid },
          select: { id: true },
        });
        if (!ok) {
          throw new Error(`INVALID_MEDIA:${mid}`);
        }
      }

      const created = await tx.gedcomEvent.create({
        data: {
          fileUuid,
          eventType,
          customType,
          value,
          cause,
          agency,
          dateId,
          placeId,
        },
        include: { date: true, place: true },
      });

      for (const iid of individualIds) {
        await tx.gedcomIndividualEvent.create({
          data: {
            fileUuid,
            individualId: iid,
            eventId: created.id,
            role: "principal",
          },
        });
      }
      for (const fid of familyIds) {
        await tx.gedcomFamilyEvent.create({
          data: {
            fileUuid,
            familyId: fid,
            eventId: created.id,
          },
        });
      }

      for (const mid of mediaIds) {
        await tx.gedcomEventMedia.create({
          data: { fileUuid, eventId: created.id, mediaId: mid },
        });
      }

      if (eventType === "BIRT" || eventType === "DEAT") {
        for (const iid of individualIds) {
          await refreshIndividualKeyFactsDenorm(changeCtx, iid);
        }
      }

      for (const fid of familyIds) {
        await refreshFamilyMarriageDenorm(changeCtx, fid);
        await refreshFamilyDivorceDenorm(changeCtx, fid);
      }

      return created;
    });

    const full = await prisma.gedcomEvent.findFirst({
      where: { id: event.id, fileUuid },
      include: EVENT_LIST_INCLUDE,
    });

    return NextResponse.json({ event: full ?? event }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("INVALID_INDIVIDUAL:")) {
      return NextResponse.json({ error: "One or more individuals are not in this tree." }, { status: 400 });
    }
    if (msg.startsWith("INVALID_FAMILY:")) {
      return NextResponse.json({ error: "One or more families are not in this tree." }, { status: 400 });
    }
    if (msg.startsWith("INVALID_MEDIA:")) {
      return NextResponse.json({ error: "One or more media IDs are not in this tree." }, { status: 400 });
    }
    throw e;
  }
});
