import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  adminNotesFilterConditions,
  adminNotesWhereSql,
  hasStructuredNoteFilters,
  parseIsTopLevelParam,
  type AdminNotesStructuredFilters,
} from "@/lib/admin/admin-notes-filter";
import {
  createGedcomNoteWithLinks,
  parseNoteLinksFromBody,
  validateNoteLinksForFile,
} from "@/lib/admin/admin-note-links";
import { newBatchId, logCreate, setBatchSummary, type ChangeCtx } from "@/lib/admin/changelog";

const NOTE_LIST_INCLUDE = {
  individualNotes: {
    include: {
      individual: { select: { id: true, fullName: true, xref: true } },
    },
  },
  familyNotes: {
    include: {
      family: {
        select: {
          id: true,
          xref: true,
          husband: { select: { fullName: true } },
          wife: { select: { fullName: true } },
        },
      },
    },
  },
  eventNotes: {
    include: {
      event: { select: { id: true, eventType: true } },
    },
  },
  sourceNotes: {
    include: {
      source: { select: { id: true, title: true, xref: true } },
    },
  },
} as const;

function parseStructuredFromSearchParams(searchParams: URLSearchParams): AdminNotesStructuredFilters {
  const cg = searchParams.get("linkedGiven")?.trim().toLowerCase() || "";
  const cl = searchParams.get("linkedLast")?.trim() || "";
  const cc = searchParams.get("contentContains")?.trim() || "";
  return {
    isTopLevel: parseIsTopLevelParam(searchParams),
    contentContains: cc || null,
    linkedGiven: cg || null,
    linkedLast: cl || null,
  };
}

async function listNotesFiltered(
  fileUuid: string,
  structured: AdminNotesStructuredFilters,
  q: string | null,
  limit: number,
  offset: number
) {
  const conditions = adminNotesFilterConditions(fileUuid, structured, q);
  const whereSql = adminNotesWhereSql(conditions);

  const fromWhere = Prisma.sql`
    FROM gedcom_notes_v2 n
    WHERE ${whereSql}
  `;

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`SELECT COUNT(*)::bigint AS c ${fromWhere}`),
    prisma.$queryRaw<[{ id: string }]>(
      Prisma.sql`SELECT n.id ${fromWhere} ORDER BY n.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    ),
  ]);

  const countVal = countRows[0]?.c;
  const total = countVal != null ? Number(countVal) : 0;
  const paginatedIds = idRows.map((r) => r.id);
  const notes =
    paginatedIds.length === 0
      ? []
      : await prisma.gedcomNote.findMany({
          where: { id: { in: paginatedIds } },
          include: NOTE_LIST_INCLUDE,
        });
  const order = new Map(paginatedIds.map((id, i) => [id, i]));
  const sorted = notes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { notes: sorted, total };
}

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || null;
  const structured = parseStructuredFromSearchParams(searchParams);
  const { limit, offset } = parseListParams(searchParams);

  const useFilteredQuery = hasStructuredNoteFilters(structured) || !!q;

  if (!useFilteredQuery) {
    const [notes, total] = await Promise.all([
      prisma.gedcomNote.findMany({
        where: { fileUuid },
        include: NOTE_LIST_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.gedcomNote.count({ where: { fileUuid } }),
    ]);
    return NextResponse.json({
      notes,
      total,
      hasMore: offset + notes.length < total,
    });
  }

  const { notes, total } = await listNotesFiltered(fileUuid, structured, q, limit, offset);
  return NextResponse.json({
    notes,
    total,
    hasMore: offset + notes.length < total,
  });
});

export const POST = withAdminAuth(async (req, user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;
  const { content, isTopLevel } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  let linksPayload;
  try {
    linksPayload = parseNoteLinksFromBody("links" in body ? body.links : undefined);
  } catch {
    return NextResponse.json({ error: "Invalid links payload" }, { status: 400 });
  }

  const validation = await validateNoteLinksForFile(fileUuid, linksPayload);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const note = await createGedcomNoteWithLinks(
    fileUuid,
    {
      content,
      isTopLevel: isTopLevel === true,
    },
    linksPayload,
  );

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const ctx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await logCreate(ctx, "note", note.id, note.xref, { ...note });
    await setBatchSummary(ctx, `Created note ${note.xref ?? note.id}`);
  });

  return NextResponse.json({ note }, { status: 201 });
});
