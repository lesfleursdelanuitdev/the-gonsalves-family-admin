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
    givenName?: { contains: string; mode: "insensitive" };
  } = { fileUuid };

  if (q) {
    where.givenName = { contains: q, mode: "insensitive" };
  }

  const [givenNames, total] = await Promise.all([
    prisma.gedcomGivenName.findMany({
      where,
      orderBy: [{ frequency: "desc" }, { givenName: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.gedcomGivenName.count({ where }),
  ]);

  return NextResponse.json({
    givenNames,
    total,
    hasMore: offset + givenNames.length < total,
  });
});
