import type { Prisma } from "@ligneous/prisma";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { gedcomPlaceSearchWhereFromQuery } from "@/lib/admin/gedcom-place-search-where";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const { limit, offset } = parseListParams(searchParams);

  const textSearch = q ? gedcomPlaceSearchWhereFromQuery(q) : undefined;
  const where: Prisma.GedcomPlaceWhereInput = {
    fileUuid,
    ...(textSearch ?? {}),
  };

  const [places, total] = await Promise.all([
    prisma.gedcomPlace.findMany({
      where,
      orderBy: { original: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.gedcomPlace.count({ where }),
  ]);

  return NextResponse.json({
    places,
    total,
    hasMore: offset + places.length < total,
  });
});
