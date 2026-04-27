import { prisma } from "@/lib/database/prisma";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export type AlbumCoverPreviewFields = {
  coverFileRef: string | null;
  coverForm: string | null;
};

type AlbumWithCoverId = { coverMediaId: string | null };

/** Loads `file_ref` / `form` for each album's `coverMediaId` in the current admin tree. */
export async function enrichAlbumsWithCoverPreview<T extends AlbumWithCoverId>(
  albums: T[],
): Promise<Array<T & AlbumCoverPreviewFields>> {
  const ids = [...new Set(albums.map((a) => a.coverMediaId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) {
    return albums.map((a) => ({ ...a, coverFileRef: null, coverForm: null }));
  }
  const fileUuid = await getAdminFileUuid();
  const rows = await prisma.gedcomMedia.findMany({
    where: { fileUuid, id: { in: ids } },
    select: { id: true, fileRef: true, form: true },
  });
  const map = new Map(rows.map((r) => [r.id, r]));
  return albums.map((a) => {
    const c = a.coverMediaId ? map.get(a.coverMediaId) : undefined;
    return {
      ...a,
      coverFileRef: c?.fileRef ?? null,
      coverForm: c?.form ?? null,
    };
  });
}

export async function enrichAlbumWithCoverPreview<T extends AlbumWithCoverId>(
  album: T,
): Promise<T & AlbumCoverPreviewFields> {
  const [one] = await enrichAlbumsWithCoverPreview([album]);
  return one;
}
