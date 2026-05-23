import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseListParams } from "@/lib/admin/admin-list-params";

/** GET /api/admin/place-resolution/suggestions?status=pending&limit=50&offset=0 */
export const GET = withAdminAuth(async (req) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  const { limit, offset } = parseListParams(searchParams);

  const where = { fileUuid, status };

  const [suggestions, total] = await Promise.all([
    prisma.placeResolutionSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        items: {
          include: {
            gedcomPlace: {
              select: {
                id: true,
                original: true,
                name: true,
                state: true,
                country: true,
                latitude: true,
                longitude: true,
                resolvedLink: { select: { id: true, resolvedPlaceId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.placeResolutionSuggestion.count({ where }),
  ]);

  return NextResponse.json({
    suggestions,
    total,
    hasMore: offset + suggestions.length < total,
  });
});
