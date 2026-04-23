import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const { limit, offset } = parseListParams(searchParams);

  const where: {
    fileUuid: string;
    OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
  } = { fileUuid };

  if (q) {
    where.OR = [
      { original: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { county: { contains: q, mode: "insensitive" } },
      { state: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
    ];
  }

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
