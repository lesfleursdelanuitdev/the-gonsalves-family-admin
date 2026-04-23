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
    OR?: Array<
      | { original: { contains: string; mode: "insensitive" } }
      | { year: number }
      | { endYear: number }
    >;
  } = { fileUuid };

  if (q) {
    const or: typeof where.OR = [
      { original: { contains: q, mode: "insensitive" } },
    ];
    const asInt = parseInt(q, 10);
    if (!Number.isNaN(asInt) && String(asInt) === q) {
      or.push({ year: asInt });
      or.push({ endYear: asInt });
    }
    where.OR = or;
  }

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
