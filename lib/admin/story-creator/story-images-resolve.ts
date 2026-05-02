import type { StoryDocument, StoryImageMediaRef } from "@/lib/admin/story-creator/story-types";

export type { StoryImageMediaRef } from "@/lib/admin/story-creator/story-types";

/** Build a ref from legacy `coverMediaId` / `coverMediaKind` fields. */
export function legacyCoverImageRef(doc: StoryDocument): StoryImageMediaRef | null {
  const id = doc.coverMediaId?.trim();
  if (!id) return null;
  return { mediaId: id, mediaKind: doc.coverMediaKind ?? "user_media" };
}

/**
 * Resolves which media to use for cover vs profile roles.
 * - If only one of `coverImage` / `profileImage` is set (including legacy cover only), it fills both roles.
 * - If both differ, each role uses its explicit image.
 */
export function resolveStoryImages(doc: StoryDocument): {
  cover: StoryImageMediaRef | null;
  profile: StoryImageMediaRef | null;
} {
  const explicitCover = doc.coverImage ?? legacyCoverImageRef(doc);
  const explicitProfile = doc.profileImage ?? null;
  const cover = explicitCover ?? explicitProfile ?? null;
  const profile = explicitProfile ?? explicitCover ?? null;
  return { cover, profile };
}

/** True when the same library asset serves both roles (avoid redundant avatar chrome). */
export function storyCoverAndProfileAreSameRef(doc: StoryDocument): boolean {
  const { cover, profile } = resolveStoryImages(doc);
  if (!cover || !profile) return false;
  return cover.mediaId === profile.mediaId && cover.mediaKind === profile.mediaKind;
}
