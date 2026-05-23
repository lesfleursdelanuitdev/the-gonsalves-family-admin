import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

/** GET /api/admin/place-resolution/resolved/[id] */
export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const resolved = await prisma.resolvedPlace.findFirst({
    where: { id, fileUuid },
    include: {
      aliases: { orderBy: { createdAt: "asc" } },
      links: {
        include: {
          gedcomPlace: {
            include: {
              _count: {
                select: {
                  events: true,
                  individualBirthPlaces: true,
                  individualDeathPlaces: true,
                  familyMarriagePlaces: true,
                  familyDivorcePlaces: true,
                  storyPlaces: true,
                  mediaLinks: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!resolved) return NextResponse.json({ error: "ResolvedPlace not found" }, { status: 404 });
  return NextResponse.json({ resolved });
});

type PatchBody = {
  displayName?: string;
  name?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geonamesId?: number | null;
  wikidataId?: string | null;
  notes?: string | null;
  status?: string;
};

/** PATCH /api/admin/place-resolution/resolved/[id] */
export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.resolvedPlace.findFirst({ where: { id, fileUuid } });
  if (!existing) return NextResponse.json({ error: "ResolvedPlace not found" }, { status: 404 });

  const body = await req.json() as PatchBody;

  if (body.displayName !== undefined && !body.displayName?.trim()) {
    return NextResponse.json({ error: "displayName cannot be empty" }, { status: 400 });
  }

  const updated = await prisma.resolvedPlace.update({
    where: { id },
    data: {
      ...(body.displayName !== undefined && { displayName: body.displayName.trim() }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.county !== undefined && { county: body.county }),
      ...(body.state !== undefined && { state: body.state }),
      ...(body.country !== undefined && { country: body.country }),
      ...(body.latitude !== undefined && { latitude: body.latitude }),
      ...(body.longitude !== undefined && { longitude: body.longitude }),
      ...(body.geonamesId !== undefined && { geonamesId: body.geonamesId }),
      ...(body.wikidataId !== undefined && { wikidataId: body.wikidataId }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json({ resolved: updated });
});

/** DELETE /api/admin/place-resolution/resolved/[id] — only if no links exist */
export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.resolvedPlace.findFirst({
    where: { id, fileUuid },
    include: { _count: { select: { links: true } } },
  });
  if (!existing) return NextResponse.json({ error: "ResolvedPlace not found" }, { status: 404 });

  if (existing._count.links > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${existing._count.links} GedcomPlace link(s) still attached` },
      { status: 409 },
    );
  }

  await prisma.resolvedPlace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
