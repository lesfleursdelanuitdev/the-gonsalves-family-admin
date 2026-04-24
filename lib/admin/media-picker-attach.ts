import { postJson } from "@/lib/infra/api";
import type { MediaPickerTargetType } from "@/components/admin/media-picker/types";

export function isMediaPickerTargetLinkable(targetType: MediaPickerTargetType): boolean {
  return targetType !== "story" && targetType !== "document";
}

/**
 * Links an existing GEDCOM media row to the given entity via the appropriate junction API.
 * Story/document targets are app-level and are not wired in the admin API yet — use `onAttach` only.
 */
export async function attachMediaToTarget(
  mediaId: string,
  targetType: MediaPickerTargetType,
  targetId: string,
): Promise<void> {
  const id = targetId.trim();
  if (!id) throw new Error("Missing target id");

  switch (targetType) {
    case "individual":
      await postJson(`/api/admin/media/${mediaId}/individual-media`, { individualId: id });
      return;
    case "family":
      await postJson(`/api/admin/media/${mediaId}/family-media`, { familyId: id });
      return;
    case "event":
      await postJson(`/api/admin/media/${mediaId}/event-media`, { eventId: id });
      return;
    case "album":
      await postJson(`/api/admin/media/${mediaId}/album-links`, { albumId: id });
      return;
    case "source":
      await postJson(`/api/admin/media/${mediaId}/source-media`, { sourceId: id });
      return;
    case "place":
      await postJson(`/api/admin/media/${mediaId}/place-media`, { placeId: id });
      return;
    case "story":
    case "document":
      throw new Error("LINK_UNSUPPORTED");
    default: {
      const _exhaustive: never = targetType;
      throw new Error(`Unsupported target: ${_exhaustive}`);
    }
  }
}
