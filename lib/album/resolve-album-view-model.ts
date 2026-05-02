import type { PrismaClient } from "@ligneous/prisma";
import type { AlbumViewModel, AlbumViewSource, MediaSummary } from "@ligneous/album-view";
import { resolveAlbumCoverMedia } from "@ligneous/album-view";
import { collectMediaIdsForGenerated } from "@ligneous/album-generated-queries";
import { enrichAlbumWithCoverPreview } from "@/lib/admin/album-cover-preview";

const MEDIA_SELECT = { id: true, title: true, fileRef: true, form: true, createdAt: true } as const;

function toSummary(m: { id: string; title: string | null; fileRef: string | null; form: string | null }): MediaSummary {
  return { id: m.id, title: m.title, fileRef: m.fileRef, form: m.form };
}

function dedupeById(items: MediaSummary[]): MediaSummary[] {
  const seen = new Set<string>();
  const out: MediaSummary[] = [];
  for (const m of items) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

async function mediaRowsForIds(
  prisma: PrismaClient,
  fileUuid: string,
  ids: string[],
): Promise<MediaSummary[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.gedcomMedia.findMany({
    where: { fileUuid, id: { in: ids } },
    select: MEDIA_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function resolveCuratedAlbumViewModelAdmin(
  prisma: PrismaClient,
  fileUuid: string,
  userId: string,
  albumId: string,
): Promise<AlbumViewModel | null> {
  const album = await prisma.album.findFirst({
    where: { id: albumId, userId },
    select: {
      id: true,
      name: true,
      description: true,
      coverMediaId: true,
      isPublic: true,
    },
  });
  if (!album) return null;

  const enriched = await enrichAlbumWithCoverPreview(album);
  const total = await prisma.albumGedcomMedia.count({ where: { albumId } });

  let coverMedia: MediaSummary | null = null;
  if (enriched.coverMediaId) {
    const cm = await prisma.gedcomMedia.findFirst({
      where: { id: enriched.coverMediaId, fileUuid },
      select: MEDIA_SELECT,
    });
    if (cm) coverMedia = toSummary(cm);
  }
  if (!coverMedia && enriched.coverFileRef) {
    coverMedia = {
      id: enriched.coverMediaId ?? "",
      title: null,
      fileRef: enriched.coverFileRef,
      form: enriched.coverForm ?? null,
    };
  }

  return {
    kind: "curated",
    source: { type: "album", albumId },
    title: enriched.name,
    description: enriched.description ?? null,
    coverMedia,
    media: [],
    totalCount: total,
    visibility: enriched.isPublic ? "public" : "private",
    canEditAlbumMetadata: true,
    canEditMembership: true,
    gridMode: "junction",
    albumId,
    presentation: "album",
  };
}

export async function resolveGeneratedAlbumViewModelAdmin(
  prisma: PrismaClient,
  fileUuid: string,
  source: Exclude<AlbumViewSource, { type: "album" }>,
): Promise<AlbumViewModel> {
  const { title, mediaIds, preferredCoverMediaId } = await collectMediaIdsForGenerated(prisma, fileUuid, source);
  const uniqueIds = [...new Set(mediaIds)];
  const inTreeIds = uniqueIds.length
    ? (
        await prisma.gedcomMedia.findMany({
          where: { fileUuid, id: { in: uniqueIds } },
          select: { id: true },
        })
      ).map((r) => r.id)
    : [];
  const media = await mediaRowsForIds(prisma, fileUuid, inTreeIds);
  const deduped = dedupeById(media);
  const stableKey = JSON.stringify(source);
  const coverMedia = resolveAlbumCoverMedia(preferredCoverMediaId, deduped, stableKey);

  return {
    kind: "generated",
    source,
    title,
    description: null,
    coverMedia,
    media: deduped,
    totalCount: deduped.length,
    visibility: "public",
    canEditAlbumMetadata: false,
    canEditMembership: false,
    gridMode: "static",
    albumId: null,
    presentation: "album",
  };
}
