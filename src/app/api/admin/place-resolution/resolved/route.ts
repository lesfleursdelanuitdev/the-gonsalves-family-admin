import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseListParams } from "@/lib/admin/admin-list-params";

/** GET /api/admin/place-resolution/resolved?q=&limit=50&offset=0 */
export const GET = withAdminAuth(async (req) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? undefined;
  const { limit, offset } = parseListParams(searchParams);

  const where = {
    fileUuid,
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { state: { contains: q, mode: "insensitive" as const } },
            { country: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [resolved, total] = await Promise.all([
    prisma.resolvedPlace.findMany({
      where,
      orderBy: { displayName: "asc" },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { links: true, aliases: true } },
      },
    }),
    prisma.resolvedPlace.count({ where }),
  ]);

  return NextResponse.json({ resolved, total, hasMore: offset + resolved.length < total });
});

type CreateBody = {
  displayName: string;
  name?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geonamesId?: number | null;
  wikidataId?: string | null;
  notes?: string | null;
  aliases?: { alias: string; aliasType?: string; notes?: string }[];
};

/** POST /api/admin/place-resolution/resolved — create a new ResolvedPlace */
export const POST = withAdminAuth(async (req, user) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  const body = await req.json() as CreateBody;

  if (!body.displayName?.trim()) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  const resolved = await prisma.$transaction(async (tx) => {
    const created = await tx.resolvedPlace.create({
      data: {
        fileUuid,
        displayName: body.displayName.trim(),
        name: body.name ?? null,
        county: body.county ?? null,
        state: body.state ?? null,
        country: body.country ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        geonamesId: body.geonamesId ?? null,
        wikidataId: body.wikidataId ?? null,
        notes: body.notes ?? null,
        createdByUserId: user.id,
      },
    });

    if (body.aliases?.length) {
      await tx.resolvedPlaceAlias.createMany({
        data: body.aliases.map((a) => ({
          resolvedPlaceId: created.id,
          alias: a.alias.trim(),
          aliasType: a.aliasType ?? "historical",
          notes: a.notes ?? null,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({ resolved }, { status: 201 });
});
