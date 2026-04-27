import type { Prisma } from "@ligneous/prisma";

type Db = Pick<Prisma.TransactionClient, "album">;

/**
 * Public albums (`is_public`) must have a unique display name per owner.
 * Personal (private) albums may reuse names.
 */
export async function findPublicAlbumNameConflict(
  db: Db,
  opts: { userId: string; nameTrimmed: string; excludeAlbumId?: string },
): Promise<string | null> {
  const { userId, nameTrimmed, excludeAlbumId } = opts;
  if (!nameTrimmed) return null;
  const row = await db.album.findFirst({
    where: {
      userId,
      isPublic: true,
      name: { equals: nameTrimmed, mode: "insensitive" },
      ...(excludeAlbumId ? { id: { not: excludeAlbumId } } : {}),
    },
    select: { id: true },
  });
  return row?.id ?? null;
}
