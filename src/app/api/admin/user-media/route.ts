import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { inferAdminMediaCategory, type AdminMediaCategory } from "@/lib/admin/infer-admin-media-category";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
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

export const GET = withAdminAuth(async (request, user, _ctx) => {
  const { searchParams } = request.nextUrl;
  const { limit, offset } = parseListParams(searchParams);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const titleContains = searchParams.get("titleContains")?.trim().toLowerCase() ?? "";
  const fileRefContains = searchParams.get("fileRefContains")?.trim().toLowerCase() ?? "";
  const fileTypeContains = searchParams.get("fileTypeContains")?.trim().toLowerCase() ?? "";
  const mediaCategory = searchParams.get("mediaCategory")?.trim() ?? "";
  const albumId = searchParams.get("albumId")?.trim() ?? "";
  const tagId = searchParams.get("tagId")?.trim() ?? "";

  const fileUuid = await getAdminFileUuid();
  const tree = await prisma.tree.findFirst({
    where: { gedcomFileId: fileUuid },
    select: { id: true },
  });

  const rows = await prisma.userMedia.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      ...(tree ? { treeId: tree.id } : {}),
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
    if (mediaCategory && mediaCategory !== toCategory(r.form, r.fileRef)) return false;
    return true;
  });

  const page = filtered.slice(offset, offset + limit);
  const media = page.map((r) => ({
    id: r.id,
    mediaScope: "my-media" as const,
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

  const body = (await request.json()) as Record<string, unknown>;
  const exportable = body.exportable === true;
  if (exportable && !tree?.id) {
    return NextResponse.json(
      { error: "Cannot mark media exportable before the admin tree is configured." },
      { status: 400 },
    );
  }
  const created = await prisma.$transaction(async (tx) => {
    const gedcomXref =
      exportable && tree?.id
        ? await reserveNextTreeMediaXref(tx, { treeId: tree.id, fileUuid })
        : null;
    return tx.userMedia.create({
      data: {
        userId: user.id,
        treeId: tree?.id ?? null,
        fileRef: normalizeStoredMediaFileRef(body.fileRef),
        storageKey:
          (typeof body.storageKey === "string" && body.storageKey.trim()) ||
          (typeof body.fileRef === "string" && body.fileRef.trim()) ||
          "",
        mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
        form: parseMediaForm(body.form),
        title: typeof body.title === "string" ? body.title : null,
        description: typeof body.description === "string" ? body.description : null,
        visibility:
          body.visibility === "public" || body.visibility === "shared" || body.visibility === "private"
            ? body.visibility
            : "private",
        reusePolicy:
          body.reusePolicy === "reusable_in_tree" ||
          body.reusePolicy === "reusable_public" ||
          body.reusePolicy === "private"
            ? body.reusePolicy
            : "private",
        exportable,
        ...(gedcomXref ? { gedcomXref } : {}),
      },
    });
  });

  return NextResponse.json({
    media: {
      id: created.id,
      mediaScope: "my-media",
      title: created.title,
      description: created.description,
      fileRef: created.fileRef,
      form: created.form,
    },
  }, { status: 201 });
});

