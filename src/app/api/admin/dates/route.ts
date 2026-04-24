import type { Prisma } from "@ligneous/prisma";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { gedcomDateSearchWhereFromQuery } from "@/lib/admin/gedcom-date-search-where";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const { limit, offset } = parseListParams(searchParams);

  const textSearch = q ? gedcomDateSearchWhereFromQuery(q) : undefined;
  const where: Prisma.GedcomDateWhereInput = {
    fileUuid,
    ...(textSearch ?? {}),
  };

  const [dates, total] = await Promise.all([
    prisma.gedcomDate.findMany({
      where,
      orderBy: [{ year: "asc" }, { month: "asc" }, { day: "asc" }, { original: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.gedcomDate.count({ where }),
  ]);

  return NextResponse.json({
    dates,
    total,
    hasMore: offset + dates.length < total,
  });
});
