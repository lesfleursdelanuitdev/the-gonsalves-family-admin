import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseListParams } from "@/lib/admin/admin-list-params";
import type { AccessRequestStatus, AccessRequestType } from "@ligneous/prisma";

const VALID_STATUSES: AccessRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];
const VALID_TYPES: AccessRequestType[] = [
  "basic_access", "individual_link", "contributor_role", "maintainer_role", "owner_role",
];

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  await requireCan({ entity: "user", action: "read", scope: "tree" });
  const treeId = process.env.ADMIN_TREE_ID!;
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const typeParam = searchParams.get("type") as AccessRequestType | null;
  const statusParam = searchParams.get("status") as AccessRequestStatus | null;
  const type = typeParam && VALID_TYPES.includes(typeParam) ? typeParam : undefined;
  const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined;
  const { limit, offset } = parseListParams(searchParams);

  const where = {
    treeId,
    ...(type ? { requestType: type } : {}),
    ...(status ? { status } : {}),
    ...(q ? {
      user: {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      },
    } : {}),
  };

  const [requests, total] = await Promise.all([
    prisma.accessRequest.findMany({
      where,
      select: {
        id: true,
        requestType: true,
        status: true,
        requestedAt: true,
        respondedAt: true,
        user: { select: { id: true, name: true, username: true, email: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.accessRequest.count({ where }),
  ]);

  return NextResponse.json({ requests, total, hasMore: offset + requests.length < total });
});
