import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseListParams } from "@/lib/admin/admin-list-params";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  await requireCan({ entity: "source", action: "read", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const { limit, offset } = parseListParams(searchParams);

  const where: {
    fileUuid: string;
    OR?: Array<{
      name?: { contains: string; mode: "insensitive" };
      xref?: { contains: string; mode: "insensitive" };
      city?: { contains: string; mode: "insensitive" };
      country?: { contains: string; mode: "insensitive" };
    }>;
  } = { fileUuid };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { xref: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
    ];
  }

  const [repositories, total] = await Promise.all([
    prisma.gedcomRepository.findMany({
      where,
      include: {
        _count: { select: { sourceRepositories: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.gedcomRepository.count({ where }),
  ]);

  return NextResponse.json({
    repositories,
    total,
    hasMore: offset + repositories.length < total,
  });
});
