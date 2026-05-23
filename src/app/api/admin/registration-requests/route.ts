import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseListParams } from "@/lib/admin/admin-list-params";
import type { PublicIntakeStatus } from "@ligneous/prisma";

const VALID_STATUSES: PublicIntakeStatus[] = ["pending", "reviewed", "approved", "rejected", "archived", "spam"];

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  await requireCan({ entity: "user", action: "read", scope: "tree" });
  const treeId = process.env.ADMIN_TREE_ID!;
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const statusParam = searchParams.get("status") as PublicIntakeStatus | null;
  const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined;
  const { limit, offset } = parseListParams(searchParams);

  const where = {
    treeId,
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { firstName: { contains: q, mode: "insensitive" as const } },
        { lastName: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { preferredUsername: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [requests, total] = await Promise.all([
    prisma.registrationRequest.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        preferredUsername: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.registrationRequest.count({ where }),
  ]);

  return NextResponse.json({ requests, total, hasMore: offset + requests.length < total });
});
