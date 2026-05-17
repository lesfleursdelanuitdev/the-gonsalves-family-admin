import { NextResponse } from "next/server";
import { RecipeDifficulty, RecipeStatus } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeReadScope } from "@/lib/infra/admin-tree-access";
import { requireCan } from "@/lib/authz/routeGuards";

function toApiDifficulty(d: RecipeDifficulty): "easy" | "medium" | "hard" {
  if (d === RecipeDifficulty.easy) return "easy";
  if (d === RecipeDifficulty.hard) return "hard";
  return "medium";
}

function toApiStatus(s: RecipeStatus): "draft" | "published" | "archived" {
  if (s === RecipeStatus.published) return "published";
  if (s === RecipeStatus.archived) return "archived";
  return "draft";
}

function requestDifficulty(raw: unknown): RecipeDifficulty {
  if (raw === "easy") return RecipeDifficulty.easy;
  if (raw === "hard") return RecipeDifficulty.hard;
  return RecipeDifficulty.medium;
}

function requestStatus(raw: unknown): RecipeStatus {
  if (raw === "published") return RecipeStatus.published;
  if (raw === "archived") return RecipeStatus.archived;
  return RecipeStatus.draft;
}

async function loadRecipe(id: string, treeId: string) {
  return prisma.recipe.findFirst({
    where: { id, treeId, deletedAt: null },
    select: {
      id: true,
      treeId: true,
      authorId: true,
      title: true,
      slug: true,
      description: true,
      introduction: true,
      yield: true,
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      restMinutes: true,
      difficulty: true,
      status: true,
      coverMediaId: true,
      coverMediaKind: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      ingredients: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true, group: true, quantity: true, unit: true, item: true, note: true },
      },
      steps: {
        orderBy: { stepNum: "asc" },
        select: { id: true, stepNum: true, body: true, imageId: true },
      },
    },
  });
}

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "recipe", action: "read", scope: "tree", treeId });

  const recipe = await loadRecipe(id, treeId);
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  return NextResponse.json({
    recipe: {
      ...recipe,
      difficulty: toApiDifficulty(recipe.difficulty),
      status: toApiStatus(recipe.status),
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
      canEdit: true,
      canDelete: true,
    },
  });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "recipe", action: "update", scope: "tree", treeId });

  const existing = await prisma.recipe.findFirst({ where: { id, treeId, deletedAt: null }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    data.title = t;
  }
  if (typeof body.slug === "string") {
    const s = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (s) {
      const conflict = await prisma.recipe.findFirst({ where: { treeId, slug: s, id: { not: id } }, select: { id: true } });
      if (conflict) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
      data.slug = s;
    }
  }
  if (body.description !== undefined) data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (body.introduction !== undefined) data.introduction = body.introduction;
  if (body.yield !== undefined) data.yield = typeof body.yield === "string" ? body.yield.trim() || null : null;
  if (body.servings !== undefined) data.servings = typeof body.servings === "number" ? body.servings : null;
  if (body.prepMinutes !== undefined) data.prepMinutes = typeof body.prepMinutes === "number" ? body.prepMinutes : null;
  if (body.cookMinutes !== undefined) data.cookMinutes = typeof body.cookMinutes === "number" ? body.cookMinutes : null;
  if (body.restMinutes !== undefined) data.restMinutes = typeof body.restMinutes === "number" ? body.restMinutes : null;
  if (body.difficulty !== undefined) data.difficulty = requestDifficulty(body.difficulty);
  if (body.status !== undefined) data.status = requestStatus(body.status);
  if (body.coverMediaId !== undefined) data.coverMediaId = body.coverMediaId ?? null;
  if (body.coverMediaKind !== undefined) data.coverMediaKind = body.coverMediaKind ?? null;
  if (Array.isArray(body.tags)) data.tags = body.tags.filter((t): t is string => typeof t === "string");

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  await prisma.recipe.update({ where: { id }, data });

  const recipe = await loadRecipe(id, treeId);
  return NextResponse.json({
    recipe: recipe
      ? { ...recipe, difficulty: toApiDifficulty(recipe.difficulty), status: toApiStatus(recipe.status), createdAt: recipe.createdAt.toISOString(), updatedAt: recipe.updatedAt.toISOString(), canEdit: true, canDelete: true }
      : null,
  });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "recipe", action: "delete", scope: "tree", treeId });

  const existing = await prisma.recipe.findFirst({ where: { id, treeId, deletedAt: null }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  await prisma.recipe.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
});
