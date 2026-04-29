import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import type { AlbumViewSource } from "@ligneous/album-view";
import { parseGeneratedMediaSource } from "@/lib/album/parse-generated-media-source";
import {
  resolveCuratedAlbumViewModelAdmin,
  resolveGeneratedAlbumViewModelAdmin,
} from "@/lib/album/resolve-album-view-model";

export const GET = withAdminAuth(async (request, user) => {
  const sp = request.nextUrl.searchParams;
  const kind = (sp.get("kind") ?? "").trim().toLowerCase();
  let fileUuid: string;
  try {
    fileUuid = await getAdminFileUuid();
  } catch {
    return NextResponse.json({ error: "Tree not configured" }, { status: 503 });
  }

  if (kind === "curated") {
    const albumId = sp.get("albumId")?.trim() ?? "";
    if (!albumId) {
      return NextResponse.json({ error: "Missing albumId" }, { status: 400 });
    }
    const model = await resolveCuratedAlbumViewModelAdmin(prisma, fileUuid, user.id, albumId);
    if (!model) return NextResponse.json({ error: "Album not found" }, { status: 404 });
    return NextResponse.json({ model });
  }

  if (kind === "generated") {
    const source = parseGeneratedMediaSource(sp.get("type"), sp.get("id"));
    if (!source) {
      return NextResponse.json({ error: "Invalid or missing type / id for generated album" }, { status: 400 });
    }
    const model = await resolveGeneratedAlbumViewModelAdmin(prisma, fileUuid, source);
    return NextResponse.json({ model });
  }

  return NextResponse.json({ error: "kind must be curated or generated" }, { status: 400 });
});
