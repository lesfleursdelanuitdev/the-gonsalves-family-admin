import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { allocateNewFamilyXref, registerXrefInFileObjects } from "@/lib/admin/admin-individual-editor-apply";
import { singleSpouseSlotForFirstParent, syncFamilySpouseXrefs } from "@/lib/admin/admin-individual-families";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  adminFamiliesFilterConditions,
  adminFamiliesWhereSql,
  hasStructuredFamilyFilters,
  parseChildrenOpParam,
  parseChildrenValueParam,
  parseHasMarriageDateParam,
  parsePartnerCountParam,
  type AdminFamiliesStructuredFilters,
} from "@/lib/admin/admin-families-filter-sql";

const FAMILY_SELECT = {
  id: true,
  xref: true,
  marriageYear: true,
  marriageDateDisplay: true,
  marriagePlaceDisplay: true,
  isDivorced: true,
  childrenCount: true,
  husband: { select: { id: true, fullName: true, sex: true, gender: true } },
  wife: { select: { id: true, fullName: true, sex: true, gender: true } },
} as const;

function parseStructuredFamiliesFilters(
  searchParams: URLSearchParams
): AdminFamiliesStructuredFilters {
  const p1g = searchParams.get("p1Given")?.trim().toLowerCase() || "";
  const p1l = searchParams.get("p1Last")?.trim() || "";
  const p2g = searchParams.get("p2Given")?.trim().toLowerCase() || "";
  const p2l = searchParams.get("p2Last")?.trim() || "";
  const co = parseChildrenOpParam(searchParams.get("childrenOp"));
  const cv = parseChildrenValueParam(searchParams.get("childrenCount"));
  const childrenActive = co != null && cv != null;
  return {
    partnerCount: parsePartnerCountParam(searchParams.get("partnerCount")),
    p1Given: p1g || null,
    p1Last: p1l || null,
    p2Given: p2g || null,
    p2Last: p2l || null,
    childrenOp: childrenActive ? co : null,
    childrenValue: childrenActive ? cv : null,
    hasMarriageDate: parseHasMarriageDateParam(searchParams),
  };
}

async function listFamiliesFiltered(
  fileUuid: string,
  structured: AdminFamiliesStructuredFilters,
  q: string | null,
  limit: number,
  offset: number
) {
  const conditions = adminFamiliesFilterConditions(fileUuid, structured, q);
  const whereSql = adminFamiliesWhereSql(conditions);

  const fromJoin = Prisma.sql`
    FROM gedcom_families_v2 f
    LEFT JOIN gedcom_individuals_v2 h ON h.id = f.husband_id
    LEFT JOIN gedcom_individuals_v2 w ON w.id = f.wife_id
    WHERE ${whereSql}
  `;

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`SELECT COUNT(*)::bigint AS c ${fromJoin}`),
    prisma.$queryRaw<[{ id: string }]>(
      Prisma.sql`SELECT f.id ${fromJoin} ORDER BY f.xref ASC LIMIT ${limit} OFFSET ${offset}`
    ),
  ]);

  const countVal = countRows[0]?.c;
  const total = countVal != null ? Number(countVal) : 0;
  const paginatedIds = idRows.map((r) => r.id);
  const families =
    paginatedIds.length === 0
      ? []
      : await prisma.gedcomFamily.findMany({
          where: { id: { in: paginatedIds } },
          select: FAMILY_SELECT,
        });
  const order = new Map(paginatedIds.map((id, i) => [id, i]));
  const sorted = families.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );
  return { families: sorted, total };
}

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || null;
  const structured = parseStructuredFamiliesFilters(searchParams);
  const { limit, offset } = parseListParams(searchParams);

  const hasStructured = hasStructuredFamilyFilters(structured);

  if (!hasStructured && !q) {
    const [families, total] = await Promise.all([
      prisma.gedcomFamily.findMany({
        where: { fileUuid },
        select: FAMILY_SELECT,
        orderBy: { xref: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.gedcomFamily.count({ where: { fileUuid } }),
    ]);
    return NextResponse.json({
      families,
      total,
      hasMore: offset + families.length < total,
    });
  }

  if (!hasStructured && q) {
    const lowerQ = q.toLowerCase();
    const where = {
      fileUuid,
      OR: [
        { husband: { fullNameLower: { contains: lowerQ } } },
        { wife: { fullNameLower: { contains: lowerQ } } },
      ],
    };
    const [families, total] = await Promise.all([
      prisma.gedcomFamily.findMany({
        where,
        select: FAMILY_SELECT,
        orderBy: { xref: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.gedcomFamily.count({ where }),
    ]);
    return NextResponse.json({
      families,
      total,
      hasMore: offset + families.length < total,
    });
  }

  const { families, total } = await listFamiliesFiltered(
    fileUuid,
    structured,
    q,
    limit,
    offset
  );
  return NextResponse.json({
    families,
    total,
    hasMore: offset + families.length < total,
  });
});

export const POST = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;

  const hRaw = typeof body.husbandId === "string" ? body.husbandId.trim() : "";
  const wRaw = typeof body.wifeId === "string" ? body.wifeId.trim() : "";
  const firstParentId =
    typeof body.firstParentId === "string" ? body.firstParentId.trim() : "";
  let husbandId: string | null = hRaw || null;
  let wifeId: string | null = wRaw || null;

  if (!husbandId && !wifeId) {
    if (!firstParentId) {
      return NextResponse.json(
        {
          error:
            "Provide at least one parent: husbandId, wifeId, or firstParentId (an existing individual in this tree).",
        },
        { status: 400 },
      );
    }
    const parent = await prisma.gedcomIndividual.findFirst({
      where: { id: firstParentId, fileUuid },
      select: { id: true, sex: true },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "firstParentId must be an individual id in this tree." },
        { status: 400 },
      );
    }
    const slot = singleSpouseSlotForFirstParent(parent.sex);
    if (slot === "husband") husbandId = parent.id;
    else wifeId = parent.id;
  }

  const marriageYear =
    typeof body.marriageYear === "number" && Number.isFinite(body.marriageYear)
      ? Math.trunc(body.marriageYear as number)
      : null;
  const childrenCount =
    typeof body.childrenCount === "number" && Number.isFinite(body.childrenCount)
      ? Math.trunc(body.childrenCount as number)
      : 0;

  const family = await prisma.$transaction(async (tx) => {
    const xref = await allocateNewFamilyXref(tx, fileUuid);
    const fam = await tx.gedcomFamily.create({
      data: {
        fileUuid,
        xref,
        husbandId,
        wifeId,
        marriageYear,
        childrenCount,
      },
    });
    await registerXrefInFileObjects(tx, fileUuid, xref, "FAM", fam.id);
    await syncFamilySpouseXrefs(tx, fam.id);
    return fam;
  });

  return NextResponse.json({ family }, { status: 201 });
});
