import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { inferAdminMediaCategory, type AdminMediaCategory } from "@/lib/admin/infer-admin-media-category";
import { normalizeStoredMediaFileRef } from "@/lib/admin/media-upload-storage";
import { reserveNextTreeMediaXref } from "@/lib/admin/gedcom-media-xref";

function toCategory(form: unknown, fileRef: unknown): AdminMediaCategory {
  return inferAdminMediaCategory(
    typeof form === "string" ? form : null,
    typeof fileRef === "string" ? fileRef : null,
  );
}

function parseMediaForm(v: unknown): "image" | "document" | "audio" | "video" | "html" | "text" | "other" {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "image" || s === "document" || s === "audio" || s === "video" || s === "html" || s === "text") {
    return s;
  }
  return "other";
}

export const GET = withAdminAuth(async (request, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({
    where: { gedcomFileId: fileUuid },
    select: { id: true },
  });
  if (!tree) {
    return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const { limit, offset } = parseListParams(searchParams);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const titleContains = searchParams.get("titleContains")?.trim().toLowerCase() ?? "";
  const fileRefContains = searchParams.get("fileRefContains")?.trim().toLowerCase() ?? "";
  const fileTypeContains = searchParams.get("fileTypeContains")?.trim().toLowerCase() ?? "";
  const mediaCategory = searchParams.get("mediaCategory")?.trim() ?? "";
  const albumId = searchParams.get("albumId")?.trim() ?? "";
  const tagId = searchParams.get("tagId")?.trim() ?? "";

  const rows = await prisma.siteMedia.findMany({
    where: {
      treeId: tree.id,
      deletedAt: null,
      ...(albumId ? { albums: { some: { albumId } } } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    },
    include: {
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      albums: { include: { album: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = rows.filter((r) => {
    const title = (r.title ?? "").toLowerCase();
    const desc = (r.description ?? "").toLowerCase();
    const ref = (r.fileRef ?? "").toLowerCase();
    const mime = (r.mimeType ?? "").toLowerCase();
    if (q && !`${title} ${desc} ${ref} ${mime}`.includes(q)) return false;
    if (titleContains && !title.includes(titleContains)) return false;
    if (fileRefContains && !ref.includes(fileRefContains)) return false;
    if (fileTypeContains && !`${mime} ${ref}`.includes(fileTypeContains)) return false;
    if (
      mediaCategory &&
      mediaCategory !== toCategory(r.form, r.fileRef)
    ) {
      return false;
    }
    return true;
  });

  const page = filtered.slice(offset, offset + limit);
  const media = page.map((r) => ({
    id: r.id,
    mediaScope: "site-assets" as const,
    createdAt: r.createdAt,
    title: r.title,
    description: r.description,
    fileRef: r.fileRef,
    form: r.form,
    individualMedia: [],
    familyMedia: [],
    sourceMedia: [],
    eventMedia: [],
    appTags: r.tags.map((t) => ({ id: t.id, tag: t.tag })),
    albumLinks: r.albums.map((a) => ({ id: a.id, album: a.album })),
    linkedCount: 0,
    placeCount: 0,
    dateCount: 0,
    tagCount: r.tags.length,
    albumCount: r.albums.length,
  }));

  return NextResponse.json({
    media,
    total: filtered.length,
    hasMore: offset + media.length < filtered.length,
  });
});

export const POST = withAdminAuth(async (request, user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({
    where: { gedcomFileId: fileUuid },
    select: { id: true },
  });
  if (!tree) {
    return NextResponse.json({ error: "Admin tree not found for current GEDCOM file." }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const created = await prisma.$transaction(async (tx) => {
    const exportable = body.exportable === true;
    const gedcomXref = exportable
      ? await reserveNextTreeMediaXref(tx, { treeId: tree.id, fileUuid })
      : null;
    return tx.siteMedia.create({
      data: {
        treeId: tree.id,
        createdBy: user.id,
        fileRef: normalizeStoredMediaFileRef(body.fileRef),
        storageKey:
          (typeof body.storageKey === "string" && body.storageKey.trim()) ||
          (typeof body.fileRef === "string" && body.fileRef.trim()) ||
          "",
        mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
        form: parseMediaForm(body.form),
        title: typeof body.title === "string" ? body.title : null,
        description: typeof body.description === "string" ? body.description : null,
        exportable,
        isPublic: body.isPublic !== false,
        ...(gedcomXref ? { gedcomXref } : {}),
      },
    });
  });

  return NextResponse.json({
    media: {
      id: created.id,
      mediaScope: "site-assets",
      title: created.title,
      description: created.description,
      fileRef: created.fileRef,
      form: created.form,
    },
  }, { status: 201 });
});

