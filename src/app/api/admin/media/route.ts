import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { normalizeStoredMediaFileRef } from "@/lib/admin/media-upload-storage";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  adminMediaFilterConditions,
  adminMediaWhereSql,
  hasStructuredMediaFilters,
  parseStructuredMediaFromSearchParams,
  type AdminMediaStructuredFilters,
} from "@/lib/admin/admin-media-filter";
import {
  logCreate,
  newBatchId,
  setBatchSummary,
  type ChangeCtx,
} from "@/lib/admin/changelog";
import { reserveNextGedcomMediaXref } from "@/lib/admin/gedcom-media-xref";

const MEDIA_LIST_INCLUDE = {
  individualMedia: {
    include: {
      individual: { select: { id: true, fullName: true } },
    },
  },
  familyMedia: {
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
  sourceMedia: {
    include: {
      source: { select: { id: true, title: true, xref: true } },
    },
  },
  eventMedia: {
    include: {
      event: { select: { id: true, eventType: true, customType: true } },
    },
  },
  appTags: { include: { tag: { select: { id: true, name: true, color: true } } } },
  albumLinks: { include: { album: { select: { id: true, name: true } } } },
} as const;

async function listMediaFiltered(
  fileUuid: string,
  structured: AdminMediaStructuredFilters,
  q: string | null,
  limit: number,
  offset: number
) {
  const conditions = adminMediaFilterConditions(fileUuid, structured, q);
  const whereSql = adminMediaWhereSql(conditions);

  const fromWhere = Prisma.sql`
    FROM gedcom_media_v2 m
    WHERE ${whereSql}
  `;

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`SELECT COUNT(*)::bigint AS c ${fromWhere}`),
    prisma.$queryRaw<[{ id: string }]>(
      Prisma.sql`SELECT m.id ${fromWhere} ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    ),
  ]);

  const countVal = countRows[0]?.c;
  const total = countVal != null ? Number(countVal) : 0;
  const paginatedIds = idRows.map((r) => r.id);
  const media =
    paginatedIds.length === 0
      ? []
      : await prisma.gedcomMedia.findMany({
          where: { id: { in: paginatedIds } },
          include: MEDIA_LIST_INCLUDE,
        });
  const order = new Map(paginatedIds.map((id, i) => [id, i]));
  const sorted = media.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { media: sorted, total };
}

export const GET = withAdminAuth(async (request, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() || null;
  const structured = parseStructuredMediaFromSearchParams(searchParams);
  const { limit, offset } = parseListParams(searchParams);

  const useFilteredQuery = hasStructuredMediaFilters(structured) || !!q;

  if (!useFilteredQuery) {
    const [media, total] = await Promise.all([
      prisma.gedcomMedia.findMany({
        where: { fileUuid },
        include: MEDIA_LIST_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.gedcomMedia.count({ where: { fileUuid } }),
    ]);
    return NextResponse.json({
      media,
      total,
      hasMore: offset + media.length < total,
    });
  }

  const { media, total } = await listMediaFiltered(fileUuid, structured, q, limit, offset);
  return NextResponse.json({
    media,
    total,
    hasMore: offset + media.length < total,
  });
});

export const POST = withAdminAuth(async (request, user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const body = await request.json();
  const { fileRef, form, title, description, linkedIndividualId, linkedFamilyId, linkedEventId } = body;

  const batchId = newBatchId();
  try {
    const media = await prisma.$transaction(async (tx) => {
      const ctx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      const xref = await reserveNextGedcomMediaXref(tx, fileUuid);
      const created = await tx.gedcomMedia.create({
        data: {
          fileUuid,
          xref,
          fileRef: normalizeStoredMediaFileRef(fileRef),
          form: form ?? null,
          title: title ?? null,
          description: description ?? null,
        },
      });

      if (linkedIndividualId) {
        await tx.gedcomIndividualMedia.create({
          data: {
            fileUuid,
            individualId: linkedIndividualId,
            mediaId: created.id,
          },
        });
      }

      if (linkedFamilyId) {
        await tx.gedcomFamilyMedia.create({
          data: {
            fileUuid,
            familyId: linkedFamilyId,
            mediaId: created.id,
          },
        });
      }

      if (linkedEventId && typeof linkedEventId === "string" && linkedEventId.trim()) {
        const eid = linkedEventId.trim();
        const ev = await tx.gedcomEvent.findFirst({
          where: { id: eid, fileUuid },
          select: { id: true },
        });
        if (!ev) throw new Error("EVENT_NOT_IN_TREE");
        await tx.gedcomEventMedia.create({
          data: { fileUuid, eventId: eid, mediaId: created.id },
        });
      }

      await logCreate(ctx, "media", created.id, created.xref, { ...created });
      await setBatchSummary(ctx, `Created media ${created.xref ?? created.id}`);
      return created;
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "EVENT_NOT_IN_TREE") {
      return NextResponse.json({ error: "Event not found in this tree." }, { status: 400 });
    }
    throw e;
  }
});
