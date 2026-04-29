import type { AlbumViewSource } from "@ligneous/album-view";

export function parseGeneratedMediaSource(
  typeRaw: string | null,
  idRaw: string | null,
): Exclude<AlbumViewSource, { type: "album" }> | null {
  const id = idRaw?.trim() ?? "";
  if (!id) return null;
  const t = (typeRaw ?? "").trim().toLowerCase();
  switch (t) {
    case "individual":
      return { type: "individual", individualId: id };
    case "family":
      return { type: "family", familyId: id };
    case "event":
      return { type: "event", eventId: id };
    case "place":
      return { type: "place", placeId: id };
    case "note":
      return { type: "note", noteId: id };
    case "date":
      return { type: "date", dateId: id };
    case "tag":
      return { type: "tag", tagId: id };
    default:
      return null;
  }
}
