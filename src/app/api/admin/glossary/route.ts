import { NextResponse } from "next/server";
import { RecipeStatus } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { getAdminTreeReadScope } from "@/lib/infra/admin-tree-access";
import { requireCan } from "@/lib/authz/routeGuards";

function toApiStatus(s: RecipeStatus): "draft" | "published" | "archived" {
  if (s === RecipeStatus.published) return "published";
  if (s === RecipeStatus.archived) return "archived";
  return "draft";
}

function requestStatus(raw: unknown): RecipeStatus {
  if (raw === "published") return RecipeStatus.published;
  if (raw === "archived") return RecipeStatus.archived;
  return RecipeStatus.draft;
}

async function allocateSlug(treeId: string, word: string): Promise<string> {
  const base = word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "word";
  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await prisma.glossaryEntry.findFirst({ where: { treeId, slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export const GET = withAdminAuth(async (request, user) => {
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "glossaryEntry", action: "read", scope: "tree", treeId });

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const dialect = sp.get("dialect")?.trim() ?? "";
  const { limit, offset } = parseListParams(sp);

  const where = {
    treeId,
    deletedAt: null as Date | null,
    ...(q ? { word: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status ? { status: requestStatus(status) } : {}),
    ...(dialect ? { dialect: { contains: dialect, mode: "insensitive" as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.glossaryEntry.findMany({
      where,
      select: {
        id: true,
        word: true,
        slug: true,
        dialect: true,
        pronunciation: true,
        partOfSpeech: true,
        meaning: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { word: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.glossaryEntry.count({ where }),
  ]);

  return NextResponse.json({
    entries: rows.map((r) => ({
      ...r,
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
  await requireCan({ entity: "glossaryEntry", action: "create", scope: "tree", treeId });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const word = typeof body.word === "string" ? body.word.trim() : "";
  if (!word) return NextResponse.json({ error: "word is required" }, { status: 400 });
  const meaning = typeof body.meaning === "string" ? body.meaning.trim() : "";
  if (!meaning) return NextResponse.json({ error: "meaning is required" }, { status: 400 });

  const slug = await allocateSlug(treeId, word);

  const entry = await prisma.glossaryEntry.create({
    data: {
      treeId,
      authorId: user.id,
      word,
      slug,
      meaning,
      dialect: typeof body.dialect === "string" ? body.dialect.trim() || null : null,
      pronunciation: typeof body.pronunciation === "string" ? body.pronunciation.trim() || null : null,
      partOfSpeech: typeof body.partOfSpeech === "string" ? body.partOfSpeech.trim() || null : null,
      usageExample: typeof body.usageExample === "string" ? body.usageExample.trim() || null : null,
      usageTranslation: typeof body.usageTranslation === "string" ? body.usageTranslation.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [],
      status: RecipeStatus.draft,
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json({ id: entry.id, slug: entry.slug }, { status: 201 });
});
