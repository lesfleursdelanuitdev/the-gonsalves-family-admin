export type MediaPickerTargetType =
  | "individual"
  | "family"
  | "event"
  | "story"
  | "album"
  | "place"
  | "source"
  | "document";

export type MediaPickerMode = "single" | "multiple";

export type MediaPickerPurpose =
  | "portrait"
  | "gallery"
  | "storyIllustration"
  | "documentaryEvidence"
  | "eventMedia"
  /** Sets explicit Gedcom profile/cover media (no junction attach). */
  | "profileCover";

export type MediaPickerMediaTypeFilter = "photo" | "document" | "video" | "audio";
