import { NextResponse } from "next/server";
import { RecipeDifficulty, RecipeStatus } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
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

async function allocateUniqueRecipeSlug(treeId: string, title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "recipe";
  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await prisma.recipe.findFirst({ where: { treeId, slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export const GET = withAdminAuth(async (request, user) => {
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "recipe", action: "read", scope: "tree", treeId });

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const difficulty = sp.get("difficulty")?.trim() ?? "";
  const { limit, offset } = parseListParams(sp);

  const where = {
    treeId,
    deletedAt: null as Date | null,
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status ? { status: requestStatus(status) } : {}),
    ...(difficulty ? { difficulty: requestDifficulty(difficulty) } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        difficulty: true,
        status: true,
        servings: true,
        prepMinutes: true,
        cookMinutes: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.recipe.count({ where }),
  ]);

  return NextResponse.json({
    recipes: rows.map((r) => ({
      ...r,
      difficulty: toApiDifficulty(r.difficulty),
      status: toApiStatus(r.status),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total,
    hasMore: offset + rows.length < total,
  });
});

export const POST = withAdminAuth(async (request, user) => {
  const treeId = await getAdminTreeId();
  await requireCan({ entity: "recipe", action: "create", scope: "tree", treeId });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled recipe";
  const slug = await allocateUniqueRecipeSlug(treeId, title);

  const recipe = await prisma.recipe.create({
    data: {
      treeId,
      authorId: user.id,
      title,
      slug,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      difficulty: requestDifficulty(body.difficulty),
      status: RecipeStatus.draft,
      tags: [],
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json({ id: recipe.id, slug: recipe.slug }, { status: 201 });
});
