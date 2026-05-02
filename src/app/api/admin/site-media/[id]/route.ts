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

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });

  const include = {
    tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    albums: { include: { album: { select: { id: true, name: true } } } },
  } as const;

  let media = await prisma.siteMedia.findFirst({
    where: { id, treeId: tree.id, deletedAt: null },
    include,
  });
  if (!media) return NextResponse.json({ error: "Site media not found" }, { status: 404 });

  // Rows created before exportable→xref wiring: backfill on first read so the editor shows an xref.
  if (media.exportable && !(media.gedcomXref?.trim())) {
    await prisma.$transaction(async (tx) => {
      const xref = await reserveNextTreeMediaXref(tx, { treeId: tree.id, fileUuid });
      await tx.siteMedia.update({ where: { id }, data: { gedcomXref: xref } });
    });
    media = await prisma.siteMedia.findFirst({
      where: { id, treeId: tree.id, deletedAt: null },
      include,
    });
    if (!media) return NextResponse.json({ error: "Site media not found" }, { status: 404 });
  }

  return NextResponse.json({
    media: {
      id: media.id,
      mediaScope: "site-assets",
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
      isPublic: media.isPublic,
      exportable: media.exportable,
    },
  });
});

export const PATCH = withAdminAuth(async (request, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  const body = (await request.json()) as Record<string, unknown>;

  const existing = await prisma.siteMedia.findFirst({
    where: { id, treeId: tree.id, deletedAt: null },
    select: { id: true, exportable: true, gedcomXref: true },
  });
  if (!existing) return NextResponse.json({ error: "Site media not found" }, { status: 404 });

  const media = await prisma.$transaction(async (tx) => {
    const exportable = body.exportable !== undefined ? Boolean(body.exportable) : existing.exportable;
    const needsXref = exportable && !existing.gedcomXref;
    const nextXref = needsXref
      ? await reserveNextTreeMediaXref(tx, { treeId: tree.id, fileUuid })
      : null;
    return tx.siteMedia.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: typeof body.title === "string" ? body.title : null } : {}),
        ...(body.description !== undefined ? { description: typeof body.description === "string" ? body.description : null } : {}),
        ...(body.fileRef !== undefined ? { fileRef: normalizeStoredMediaFileRef(body.fileRef) } : {}),
        ...(body.form !== undefined ? { form: parseMediaForm(body.form) } : {}),
        ...(body.mimeType !== undefined ? { mimeType: typeof body.mimeType === "string" ? body.mimeType : null } : {}),
        ...(body.isPublic !== undefined ? { isPublic: Boolean(body.isPublic) } : {}),
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

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({ where: { gedcomFileId: fileUuid }, select: { id: true } });
  if (!tree) return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  const existing = await prisma.siteMedia.findFirst({ where: { id, treeId: tree.id, deletedAt: null }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Site media not found" }, { status: 404 });
  await prisma.siteMedia.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
});

