import { NextResponse } from "next/server";
import { RecipeStatus } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
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

async function loadEntry(id: string, treeId: string) {
  return prisma.glossaryEntry.findFirst({
    where: { id, treeId, deletedAt: null },
    select: {
      id: true,
      treeId: true,
      authorId: true,
      word: true,
      slug: true,
      dialect: true,
      pronunciation: true,
      partOfSpeech: true,
      meaning: true,
      usageExample: true,
      usageTranslation: true,
      notes: true,
      tags: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "glossaryEntry", action: "read", scope: "tree", treeId });

  const entry = await loadEntry(id, treeId);
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  return NextResponse.json({
    entry: {
      ...entry,
      status: toApiStatus(entry.status),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      canEdit: true,
      canDelete: true,
    },
  });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "glossaryEntry", action: "update", scope: "tree", treeId });

  const existing = await prisma.glossaryEntry.findFirst({ where: { id, treeId, deletedAt: null }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.word === "string") {
    const w = body.word.trim();
    if (!w) return NextResponse.json({ error: "word cannot be empty" }, { status: 400 });
    data.word = w;
  }
  if (typeof body.slug === "string") {
    const s = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (s) {
      const conflict = await prisma.glossaryEntry.findFirst({ where: { treeId, slug: s, id: { not: id } }, select: { id: true } });
      if (conflict) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
      data.slug = s;
    }
  }
  if (typeof body.meaning === "string") {
    const m = body.meaning.trim();
    if (!m) return NextResponse.json({ error: "meaning cannot be empty" }, { status: 400 });
    data.meaning = m;
  }
  if (body.dialect !== undefined) data.dialect = typeof body.dialect === "string" ? body.dialect.trim() || null : null;
  if (body.pronunciation !== undefined) data.pronunciation = typeof body.pronunciation === "string" ? body.pronunciation.trim() || null : null;
  if (body.partOfSpeech !== undefined) data.partOfSpeech = typeof body.partOfSpeech === "string" ? body.partOfSpeech.trim() || null : null;
  if (body.usageExample !== undefined) data.usageExample = typeof body.usageExample === "string" ? body.usageExample.trim() || null : null;
  if (body.usageTranslation !== undefined) data.usageTranslation = typeof body.usageTranslation === "string" ? body.usageTranslation.trim() || null : null;
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  if (body.status !== undefined) data.status = requestStatus(body.status);
  if (Array.isArray(body.tags)) data.tags = body.tags.filter((t): t is string => typeof t === "string");

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  await prisma.glossaryEntry.update({ where: { id }, data });

  const entry = await loadEntry(id, treeId);
  return NextResponse.json({
    entry: entry
      ? { ...entry, status: toApiStatus(entry.status), createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString(), canEdit: true, canDelete: true }
      : null,
  });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "glossaryEntry", action: "delete", scope: "tree", treeId });

  const existing = await prisma.glossaryEntry.findFirst({ where: { id, treeId, deletedAt: null }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  await prisma.glossaryEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
});
