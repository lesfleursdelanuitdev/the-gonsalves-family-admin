import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseListParams } from "@/lib/admin/admin-list-params";
import type { ContributionType, PublicIntakeStatus } from "@ligneous/prisma";

const VALID_TYPES: ContributionType[] = ["memory", "suggestion", "recipe", "language", "folklore"];
const VALID_STATUSES: PublicIntakeStatus[] = ["pending", "reviewed", "approved", "rejected", "archived", "spam"];

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  await requireCan({ entity: "user", action: "read", scope: "tree" });
  const treeId = process.env.ADMIN_TREE_ID!;
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const typeParam = searchParams.get("type") as ContributionType | null;
  const statusParam = searchParams.get("status") as PublicIntakeStatus | null;
  const type = typeParam && VALID_TYPES.includes(typeParam) ? typeParam : undefined;
  const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined;
  const { limit, offset } = parseListParams(searchParams);

  const where = {
    treeId,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { contributorFirstName: { contains: q, mode: "insensitive" as const } },
        { contributorLastName: { contains: q, mode: "insensitive" as const } },
        { contributorEmail: { contains: q, mode: "insensitive" as const } },
        { content: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [contributions, total] = await Promise.all([
    prisma.contribution.findMany({
      where,
      select: {
        id: true,
        contributorFirstName: true,
        contributorLastName: true,
        contributorEmail: true,
        type: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        _count: { select: { attachments: true, individuals: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.contribution.count({ where }),
  ]);

  return NextResponse.json({ contributions, total, hasMore: offset + contributions.length < total });
});
