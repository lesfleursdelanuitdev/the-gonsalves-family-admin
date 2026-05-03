import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { tagMayMutate } from "@/lib/admin/tag-admin-access";
import { gedcomMediaWithAppTagsInclude } from "@/lib/admin/gedcom-media-with-tags-include";

async function loadTagReadable(id: string, user: { id: string; isWebsiteOwner: boolean }) {
  return prisma.tag.findFirst({
    where: { id, OR: [{ isGlobal: true }, { userId: user.id }] },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      isGlobal: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function findNameConflict(
  name: string,
  excludeId: string,
  scope: { isGlobal: boolean; userId: string | null },
) {
  if (scope.isGlobal) {
    return prisma.tag.findFirst({
      where: {
        id: { not: excludeId },
        isGlobal: true,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
  }
  if (!scope.userId) return null;
  return prisma.tag.findFirst({
    where: {
      id: { not: excludeId },
      userId: scope.userId,
      isGlobal: false,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });
}

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const tag = await loadTagReadable(id, user);
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  const canMutate = tagMayMutate(tag, user);
  const fileUuid = await getAdminFileUuid();
  const profileMediaSelection = await prisma.tagProfileMedia.findUnique({
    where: { tagId_fileUuid: { tagId: id, fileUuid } },
    include: { media: gedcomMediaWithAppTagsInclude },
  });

  return NextResponse.json({
    tag: {
      ...tag,
      canEdit: canMutate,
      canDelete: canMutate,
    },
    profileMediaSelection,
  });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const existing = await prisma.tag.findFirst({
    where: { id },
    select: { id: true, name: true, isGlobal: true, userId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  if (!tagMayMutate(existing, user)) {
    return NextResponse.json(
      {
        error: existing.isGlobal
          ? "Only a site owner can edit global tags."
          : "You can only edit tags you own.",
      },
      { status: 403 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;
  const data: { name?: string; color?: string | null; description?: string | null } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    const conflict = await findNameConflict(name, id, { isGlobal: existing.isGlobal, userId: existing.userId });
    if (conflict) {
      return NextResponse.json(
        { error: existing.isGlobal ? "Another global tag already uses this name." : "You already have a tag with this name." },
        { status: 409 },
      );
    }
    data.name = name;
  }

  if (body.color !== undefined) {
    if (body.color === null || body.color === "") {
      data.color = null;
    } else if (typeof body.color === "string") {
      const c = body.color.trim().slice(0, 7);
      data.color = c || null;
    }
  }

  if (body.description !== undefined) {
    if (body.description === null || body.description === "") {
      data.description = null;
    } else if (typeof body.description === "string") {
      data.description = body.description.trim() || null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.tag.update({
    where: { id },
    data,
  });

  const tag = await loadTagReadable(id, user);
  const fileUuid = await getAdminFileUuid();
  const profileMediaSelection = await prisma.tagProfileMedia.findUnique({
    where: { tagId_fileUuid: { tagId: id, fileUuid } },
    include: { media: gedcomMediaWithAppTagsInclude },
  });

  return NextResponse.json({
    tag: tag ? { ...tag, canEdit: true, canDelete: true } : null,
    profileMediaSelection,
  });
});

/**
 * Delete a tag. `TaggedItem` and `GedcomMediaAppTag` rows cascade from the schema.
 * - Non-global tags: only the owning user may delete.
 * - Global tags: only a site owner may delete.
 */
export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;

  const tag = await prisma.tag.findFirst({
    where: { id },
    select: { id: true, userId: true, isGlobal: true, name: true },
  });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const isOwnUserTag = !tag.isGlobal && tag.userId === user.id;
  const isGlobalDeletableByOwner = tag.isGlobal && user.isWebsiteOwner;

  if (!isOwnUserTag && !isGlobalDeletableByOwner) {
    return NextResponse.json(
      {
        error: tag.isGlobal
          ? "Only a site owner can delete global tags."
          : "You can only delete tags you own.",
      },
      { status: 403 },
    );
  }

  await prisma.tag.delete({ where: { id: tag.id } });
  return NextResponse.json({ success: true });
});
