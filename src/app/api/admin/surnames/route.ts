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
    surname?: { contains: string; mode: "insensitive" };
  } = { fileUuid };

  if (q) {
    where.surname = { contains: q, mode: "insensitive" };
  }

  const [surnames, total] = await Promise.all([
    prisma.gedcomSurname.findMany({
      where,
      orderBy: [{ frequency: "desc" }, { surname: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.gedcomSurname.count({ where }),
  ]);

  return NextResponse.json({
    surnames,
    total,
    hasMore: offset + surnames.length < total,
  });
});
