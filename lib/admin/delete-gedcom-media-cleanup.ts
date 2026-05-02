import type { Prisma } from "@ligneous/prisma";
import { EntityType } from "@ligneous/prisma";

type Tx = Prisma.TransactionClient;

/**
 * Rows that reference a `gedcom_media_v2` id without an FK cascade must be removed (or nulled)
 * before deleting the media row, or left as orphans after delete.
 */
export async function cleanupNonFkReferencesToGedcomMedia(
  tx: Tx,
  mediaId: string,
  fileUuid: string,
): Promise<void> {
  await tx.gedcomFileObject.deleteMany({
    where: { fileUuid, objectUuid: mediaId },
  });

  await tx.album.updateMany({
    where: { coverMediaId: mediaId },
    data: { coverMediaId: null },
  });

  await tx.story.updateMany({
    where: { coverMediaId: mediaId },
    data: { coverMediaId: null, coverMediaKind: null },
  });

  await tx.story.updateMany({
    where: { profileMediaId: mediaId },
    data: { profileMediaId: null, profileMediaKind: null },
  });

  await tx.albumMedia.deleteMany({
    where: { mediaId },
  });

  await tx.taggedItem.deleteMany({
    where: { entityType: EntityType.media, entityId: mediaId },
  });

  await tx.media.deleteMany({
    where: { mediaId },
  });
}
