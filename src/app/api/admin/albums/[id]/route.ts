import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { findPublicAlbumNameConflict } from "@/lib/admin/admin-album-public-name";
import { enrichAlbumWithCoverPreview } from "@/lib/admin/album-cover-preview";

const ALBUM_DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  coverMediaId: true,
  isPublic: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function assertCoverMediaInAdminTree(coverMediaId: string | null) {
  if (!coverMediaId?.trim()) return;
  const fileUuid = await getAdminFileUuid();
  const m = await prisma.gedcomMedia.findFirst({
    where: { id: coverMediaId.trim(), fileUuid },
    select: { id: true },
  });
  if (!m) {
    throw new Error("Cover media must be an OBJE in the current admin tree.");
  }
}

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const album = await prisma.album.findFirst({
    where: { id, userId: user.id },
    select: ALBUM_DETAIL_SELECT,
  });
  if (!album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }
  return NextResponse.json({ album: await enrichAlbumWithCoverPreview(album) });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const existing = await prisma.album.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, isPublic: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const raw = body.name;
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    data.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    const d = body.description;
    data.description =
      d == null || d === "" ? null : typeof d === "string" ? d.trim() || null : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "isPublic")) {
    data.isPublic = Boolean(body.isPublic);
  }

  if (Object.prototype.hasOwnProperty.call(body, "coverMediaId")) {
    const c = body.coverMediaId;
    data.coverMediaId =
      c == null || c === "" ? null : typeof c === "string" ? c.trim() : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "sortOrder")) {
    const n = body.sortOrder;
    if (typeof n === "number" && Number.isFinite(n)) {
      data.sortOrder = Math.trunc(n);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const nextName = (data.name as string | undefined) ?? existing.name;
  const nextPublic =
    data.isPublic !== undefined ? Boolean(data.isPublic) : existing.isPublic;

  if (nextPublic) {
    const conflict = await findPublicAlbumNameConflict(prisma, {
      userId: user.id,
      nameTrimmed: String(nextName).trim(),
      excludeAlbumId: id,
    });
    if (conflict) {
      return NextResponse.json(
        {
          error:
            "A public album with this name already exists. Choose another name, or keep this album personal (not public).",
        },
        { status: 409 },
      );
    }
  }

  try {
    if (data.coverMediaId !== undefined) {
      await assertCoverMediaInAdminTree(data.coverMediaId as string | null);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid cover media";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const updated = await prisma.album.update({
      where: { id },
      data,
      select: ALBUM_DETAIL_SELECT,
    });
    return NextResponse.json({ album: await enrichAlbumWithCoverPreview(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    if (msg.includes("albums_user_public_lower_trim_name_unique")) {
      return NextResponse.json(
        {
          error:
            "A public album with this name already exists. Choose another name, or keep this album personal (not public).",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const res = await prisma.album.deleteMany({
    where: { id, userId: user.id },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
});
