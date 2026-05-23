import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

const PLACE_USAGE_COUNT = {
  events: true,
  individualBirthPlaces: true,
  individualDeathPlaces: true,
  familyMarriagePlaces: true,
  familyDivorcePlaces: true,
  storyPlaces: true,
  mediaLinks: true,
} as const;

/** GET /api/admin/place-resolution/suggestions/[id] — detail with per-item usage counts */
export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const suggestion = await prisma.placeResolutionSuggestion.findFirst({
    where: { id, fileUuid },
    include: {
      items: {
        include: {
          gedcomPlace: {
            include: {
              _count: { select: PLACE_USAGE_COUNT },
              resolvedLink: {
                include: {
                  resolvedPlace: {
                    select: { id: true, displayName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

  return NextResponse.json({ suggestion });
});

/** PATCH /api/admin/place-resolution/suggestions/[id] — { action: "ignore" | "restore" } */
export const PATCH = withAdminAuth(async (req, user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const suggestion = await prisma.placeResolutionSuggestion.findFirst({
    where: { id, fileUuid },
  });
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

  const body = await req.json() as { action?: string };
  const action = body.action;

  if (action === "ignore") {
    if (suggestion.status === "ignored") {
      return NextResponse.json({ error: "Already ignored" }, { status: 409 });
    }
    const updated = await prisma.placeResolutionSuggestion.update({
      where: { id },
      data: {
        status: "ignored",
        reviewedAt: new Date(),
        reviewedByUserId: user.id,
      },
    });
    return NextResponse.json({ suggestion: updated });
  }

  if (action === "restore") {
    if (suggestion.status === "applied") {
      return NextResponse.json({ error: "Cannot restore an applied suggestion" }, { status: 409 });
    }
    const updated = await prisma.placeResolutionSuggestion.update({
      where: { id },
      data: {
        status: "pending",
        reviewedAt: null,
        reviewedByUserId: null,
      },
    });
    return NextResponse.json({ suggestion: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});
