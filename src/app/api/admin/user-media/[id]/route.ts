import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { normalizeStoredMediaFileRef } from "@/lib/admin/media-upload-storage";
import { reserveNextTreeMediaXref } from "@/lib/admin/gedcom-media-xref";

function parseMediaForm(v: unknown): "image" | "document" | "audio" | "video" | "html" | "text" | "other" {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "image" || s === "document" || s === "audio" || s === "video" || s === "html" || s === "text") return s;
  return "other";
}

function parseUserMediaVisibility(v: unknown): "private" | "shared" | "public" | undefined {
  if (v === "private" || v === "shared" || v === "public") return v;
  return undefined;
}

function parseUserMediaReusePolicy(v: unknown): "private" | "reusable_in_tree" | "reusable_public" | undefined {
  if (v === "private" || v === "reusable_in_tree" || v === "reusable_public") return v;
  return undefined;
}

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });

  const include = {
    tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    albums: { include: { album: { select: { id: true, name: true } } } },
  } as const;

  let media = await prisma.userMedia.findFirst({
    where: { id, treeId: tree.id, userId: user.id, deletedAt: null },
    include,
  });
  if (!media) return NextResponse.json({ error: "User media not found" }, { status: 404 });

  if (media.exportable && !(media.gedcomXref?.trim())) {
    await prisma.$transaction(async (tx) => {
      const xref = await reserveNextTreeMediaXref(tx, { treeId: tree.id, fileUuid });
      await tx.userMedia.update({ where: { id }, data: { gedcomXref: xref } });
    });
    media = await prisma.userMedia.findFirst({
      where: { id, treeId: tree.id, userId: user.id, deletedAt: null },
      include,
    });
    if (!media) return NextResponse.json({ error: "User media not found" }, { status: 404 });
  }

  return NextResponse.json({
    media: {
      id: media.id,
      mediaScope: "my-media",
      xref: media.gedcomXref,
      title: media.title,
      description: media.description,
      fileRef: media.fileRef,
      form: media.form,
      createdAt: media.createdAt,
      appTags: media.tags.map((t) => ({ id: t.id, tag: t.tag })),
      albumLinks: media.albums.map((a) => ({ id: a.id, album: a.album })),
      individualMedia: [],
      familyMedia: [],
      sourceMedia: [],
      eventMedia: [],
      placeLinks: [],
      dateLinks: [],
      visibility: media.visibility,
      reusePolicy: media.reusePolicy,
      exportable: media.exportable,
    },
  });
});

export const PATCH = withAdminAuth(async (request, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  const body = (await request.json()) as Record<string, unknown>;
  const existing = await prisma.userMedia.findFirst({
    where: { id, treeId: tree.id, userId: user.id, deletedAt: null },
    select: { id: true, exportable: true, gedcomXref: true },
  });
  if (!existing) return NextResponse.json({ error: "User media not found" }, { status: 404 });

  const vis = body.visibility !== undefined ? parseUserMediaVisibility(body.visibility) : undefined;
  const reuse = body.reusePolicy !== undefined ? parseUserMediaReusePolicy(body.reusePolicy) : undefined;

  const media = await prisma.$transaction(async (tx) => {
    const exportable = body.exportable !== undefined ? Boolean(body.exportable) : existing.exportable;
    const needsXref = exportable && !existing.gedcomXref;
    const nextXref = needsXref
      ? await reserveNextTreeMediaXref(tx, { treeId: tree.id, fileUuid })
      : null;
    return tx.userMedia.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: typeof body.title === "string" ? body.title : null } : {}),
        ...(body.description !== undefined ? { description: typeof body.description === "string" ? body.description : null } : {}),
        ...(body.fileRef !== undefined ? { fileRef: normalizeStoredMediaFileRef(body.fileRef) } : {}),
        ...(body.form !== undefined ? { form: parseMediaForm(body.form) } : {}),
        ...(body.mimeType !== undefined ? { mimeType: typeof body.mimeType === "string" ? body.mimeType : null } : {}),
        ...(vis !== undefined ? { visibility: vis } : {}),
        ...(reuse !== undefined ? { reusePolicy: reuse } : {}),
        ...(body.exportable !== undefined ? { exportable: Boolean(body.exportable) } : {}),
        ...(nextXref ? { gedcomXref: nextXref } : {}),
        ...(body.storageKey !== undefined &&
        typeof body.storageKey === "string" &&
        body.storageKey.trim()
          ? { storageKey: body.storageKey.trim() }
          : {}),
      },
    });
  });
  return NextResponse.json({ media });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  const existing = await prisma.userMedia.findFirst({
    where: { id, treeId: tree.id, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "User media not found" }, { status: 404 });
  await prisma.userMedia.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
});

