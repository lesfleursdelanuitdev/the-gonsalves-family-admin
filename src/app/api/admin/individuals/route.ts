import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { createIndividualFromEditorPayload } from "@/lib/admin/admin-individual-editor-apply";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { parseIndividualEditorPayload } from "@/lib/forms/individual-editor-payload";
import { ADMIN_INDIVIDUAL_DETAIL_INCLUDE } from "@/app/api/admin/individuals/individual-detail-include";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  adminIndividualsFilterConditions,
  adminIndividualsWhereSql,
  hasStructuredFilters,
  parseLivingParam,
  parseSexParam,
  parseYearParam,
  type AdminIndividualsStructuredFilters,
} from "@/lib/admin/admin-individuals-filter-sql";

const INDIVIDUAL_SELECT = {
  id: true,
  xref: true,
  fullName: true,
  sex: true,
  birthYear: true,
  deathYear: true,
  birthDateDisplay: true,
  deathDateDisplay: true,
  isLiving: true,
  individualNameForms: {
    where: { isPrimary: true },
    take: 1,
    select: {
      isPrimary: true,
      sortOrder: true,
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
  profileMediaSelection: {
    select: {
      media: { select: { id: true, fileRef: true, form: true } },
    },
  },
} as const;

function parseStructuredFilters(
  searchParams: URLSearchParams
): AdminIndividualsStructuredFilters {
  const givenRaw = searchParams.get("givenName")?.trim().toLowerCase() || "";
  const lastRaw = searchParams.get("lastName")?.trim() || "";
  return {
    sex: parseSexParam(searchParams.get("sex")),
    isLiving: parseLivingParam(searchParams),
    givenContains: givenRaw || null,
    lastNamePrefix: lastRaw || null,
    birthYearMin: parseYearParam(searchParams.get("birthYearMin")),
    birthYearMax: parseYearParam(searchParams.get("birthYearMax")),
    deathYearMin: parseYearParam(searchParams.get("deathYearMin")),
    deathYearMax: parseYearParam(searchParams.get("deathYearMax")),
  };
}

async function listIndividualsFiltered(
  fileUuid: string,
  structured: AdminIndividualsStructuredFilters,
  q: string | null,
  limit: number,
  offset: number
) {
  const conditions = adminIndividualsFilterConditions(fileUuid, structured, q);
  const whereSql = adminIndividualsWhereSql(conditions);

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM gedcom_individuals_v2 i
        WHERE ${whereSql}
      `
    ),
    prisma.$queryRaw<[{ id: string }]>(
      Prisma.sql`
        SELECT i.id
        FROM gedcom_individuals_v2 i
        WHERE ${whereSql}
        ORDER BY i.full_name_lower ASC NULLS LAST
        LIMIT ${limit}
        OFFSET ${offset}
      `
    ),
  ]);

  const countVal = countRows[0]?.c;
  const total = countVal != null ? Number(countVal) : 0;
  const paginatedIds = idRows.map((r) => r.id);
  const individuals =
    paginatedIds.length === 0
      ? []
      : await prisma.gedcomIndividual.findMany({
          where: { id: { in: paginatedIds } },
          select: INDIVIDUAL_SELECT,
        });
  const order = new Map(paginatedIds.map((id, i) => [id, i]));
  const sorted = individuals.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );
  return { individuals: sorted, total };
}

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || null;
  const structured = parseStructuredFilters(searchParams);
  const { limit, offset } = parseListParams(searchParams);

  const useFilterQuery = hasStructuredFilters(structured) || !!q;

  if (!useFilterQuery) {
    const [individuals, total] = await Promise.all([
      prisma.gedcomIndividual.findMany({
        where: { fileUuid },
        select: INDIVIDUAL_SELECT,
        orderBy: { fullNameLower: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.gedcomIndividual.count({ where: { fileUuid } }),
    ]);
    return NextResponse.json({
      individuals,
      total,
      hasMore: offset + individuals.length < total,
    });
  }

  const { individuals, total } = await listIndividualsFiltered(
    fileUuid,
    structured,
    q,
    limit,
    offset
  );
  return NextResponse.json({
    individuals,
    total,
    hasMore: offset + individuals.length < total,
  });
});

export const POST = withAdminAuth(async (req, user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;

  const parsed = parseIndividualEditorPayload(body);
  if (!parsed.nameForms?.length) {
    return NextResponse.json(
      { error: "nameForms (or legacy names) must define at least one name block" },
      { status: 400 },
    );
  }
  const hasNameParts = parsed.nameForms.some(
    (f) => f.givenNames.some((g) => g.trim()) || f.surnames.some((s) => s.text.trim()),
  );
  if (!hasNameParts) {
    return NextResponse.json(
      { error: "At least one given name or surname must be non-empty across name forms" },
      { status: 400 },
    );
  }

  let newId: string;
  try {
    newId = await prisma.$transaction(async (tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
      return createIndividualFromEditorPayload(changeCtx, parsed);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const individual = await prisma.gedcomIndividual.findUnique({
    where: { id: newId },
    include: ADMIN_INDIVIDUAL_DETAIL_INCLUDE,
  });

  return NextResponse.json({ individual }, { status: 201 });
});
