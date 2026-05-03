import type { JSONContent } from "@tiptap/core";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";

export type StoryLifecycleStatus = "draft" | "published";

/** How to introduce the story author name in preview and public views. */
export type StoryAuthorPrefixMode = "by" | "author_label" | "custom" | "none";

/** One byline credit (name + how the line is prefixed). Persisted in `stories.body` JSON. */
export type StoryAuthorCredit = {
  id: string;
  name: string;
  authorPrefixMode?: StoryAuthorPrefixMode;
  /** When `authorPrefixMode` is `custom`, text before the name (spaces optional). */
  authorPrefixCustom?: string;
};

/** Row-level width and float behavior for story blocks (editor + preview). */
export type StoryBlockWidthMode = "full" | "wide" | "medium" | "narrow" | "custom";

export type StoryBlockWidthUnit = "%" | "px";

export type StoryBlockRowAlignment = "left" | "center" | "right";

export type StoryBlockRowLayout = {
  widthMode?: StoryBlockWidthMode;
  widthValue?: number;
  widthUnit?: StoryBlockWidthUnit;
  alignment?: StoryBlockRowAlignment;
  /** `block` = full row; `float` = float beside following rich text (media/embed). */
  displayMode?: "block" | "float";
  float?: "left" | "right";
};

export function defaultStoryBlockRowLayout(): StoryBlockRowLayout {
  return {
    widthMode: "full",
    alignment: "center",
    displayMode: "block",
  };
}

/** Optional per-block styling; CSS is scoped to the block in the editor and preview. */
export type StoryBlockDesign = {
  className?: string;
  css?: string;
};

/** Timeline / reader annotations; stored inside block JSON in `content_json` (no DB column). */
export type StoryBlockDateAnnotation = {
  date: string;
  dateDisplay: string;
  endDate?: string;
};

/** Matches Prisma `StoryKind` — used in local drafts until server sync. */
export type StoryDocumentKind = "story" | "article" | "post";

/**
 * Denormalized place link on a local story draft (same `/api/admin/places` rows as `GedcomPlaceInput` suggestions).
 * Future server sync: maps to relational `story_places` / `StoryPlace` (storyId + placeId); `id` is the Gedcom place row id.
 */
export type StoryLinkedPlace = {
  id: string;
  /** One-line label for lists and preview (see `formatPlaceSuggestionLabel`). */
  label: string;
  name?: string | null;
  original?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
};

/** Matches Prisma `StoryCoverMediaKind` — clarifies which system `coverMediaId` refers to. */
export type StoryCoverMediaKind = "user_media" | "gedcom_media" | "site_media";

/** Library (or tree) media selection for story cover / profile header images. */
export type StoryImageMediaRef = {
  mediaId: string;
  mediaKind: StoryCoverMediaKind;
};

export type StoryRichTextBlock = {
  id: string;
  type: "richText";
  doc: JSONContent | Record<string, unknown>;
  /** Row width / alignment (rich text stays on its own row; no float). */
  rowLayout?: StoryBlockRowLayout;
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
};

/** Raster / video / audio attached from the media library (picker, thumbnail, captions). */
export type StoryMediaBlock = {
  id: string;
  type: "media";
  mediaId?: string;
  /** Display title for this block (optional). Shown as “Untitled media” when empty. */
  label: string;
  caption?: string;
  /** Position of the title relative to the media frame. Defaults to `above` when omitted. */
  titlePlacement?: StoryBlockTextPlacement;
  /** Position of the caption relative to the media frame. Defaults to `below` when omitted. */
  captionPlacement?: StoryBlockTextPlacement;
  layoutAlign?: StoryEmbedLayoutAlign;
  widthPreset?: StoryEmbedWidthPreset;
  heightPreset?: StoryEmbedHeightPreset;
  fullWidth?: boolean;
  textWrap?: boolean;
  linkMode?: StoryEmbedLinkMode;
  /** Row width, alignment, and optional float-with-text layout. */
  rowLayout?: StoryBlockRowLayout;
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
};

/** Non-media embeds: maps, timelines, trees, documents, graphs. */
export type StoryGeneralEmbedKind = "document" | "timeline" | "map" | "tree" | "graph";

/** Layout for media / embed blocks (theme-controlled presets, not freeform CSS). */
export type StoryEmbedLayoutAlign = "above" | "below" | "left" | "right" | "wrapped" | "center" | "full";

/** Where title or caption sits relative to the media / embed frame (each field is independent). */
export type StoryBlockTextPlacement = "above" | "below" | "left" | "right";

export type StoryEmbedWidthPreset = "small" | "medium" | "large" | "content" | "full";

/** Theme-controlled vertical footprint for placeholders (no freeform CSS). */
export type StoryEmbedHeightPreset = "auto" | "compact" | "default" | "tall" | "hero";

export type StoryEmbedLinkMode = "none" | "same_window" | "new_tab";

export type StoryEmbedBlock = {
  id: string;
  type: "embed";
  embedKind: StoryGeneralEmbedKind;
  label: string;
  sublabel?: string;
  caption?: string;
  /** Position of the title relative to the embed frame. Defaults to `above` when omitted. */
  titlePlacement?: StoryBlockTextPlacement;
  /** Position of the caption relative to the embed frame. Defaults to `below` when omitted. */
  captionPlacement?: StoryBlockTextPlacement;
  layoutAlign?: StoryEmbedLayoutAlign;
  widthPreset?: StoryEmbedWidthPreset;
  heightPreset?: StoryEmbedHeightPreset;
  fullWidth?: boolean;
  textWrap?: boolean;
  linkMode?: StoryEmbedLinkMode;
  rowLayout?: StoryBlockRowLayout;
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
};

/**
 * Content inside a column cell. Columns may nest one level (section → columns → columns);
 * depth is enforced in the editor and migration (max 2 levels total).
 */
export type StoryColumnNestedBlock =
  | StoryRichTextBlock
  | StoryMediaBlock
  | StoryEmbedBlock
  | StoryColumnsBlock
  | StoryContainerBlock;

/**
 * Vertical distribution of blocks inside a column (`flex-direction: column` → `justify-content`).
 * Stored as CSS values for a straightforward render path.
 */
export type StoryColumnStackJustify =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type StoryColumnSlot = {
  id: string;
  /** Ordered nested blocks (text, media, embed). May be empty. */
  blocks: StoryColumnNestedBlock[];
  /** Vertical packing of stacked blocks (default flex-start = top). */
  stackJustify?: StoryColumnStackJustify;
  /** Gap between stacked blocks in this column (`rem`). */
  stackGapRem?: number;
};

export type StoryColumnsBlock = {
  id: string;
  type: "columns";
  columns: [StoryColumnSlot, StoryColumnSlot];
  /**
   * Target width split as percentages (two columns). Rendered with CSS `fr` tracks
   * (`minmax(0, p0 fr) minmax(0, p1 fr)`) so the gutter does not compress ratio.
   */
  columnWidthPercents?: [number, number];
  /** Horizontal gap between columns in `rem` (stable, theme-relative). */
  columnGapRem?: number;
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
};

export type StoryDividerBlock = {
  id: string;
  type: "divider";
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
};

/** Layout-only container; children are full section-level block shapes (recursive). */
export type StoryContainerBlockProps = {
  label?: string;
  background?: "none" | "subtle" | "custom";
  /** When `background` is `custom`, optional CSS color (e.g. `oklch(...)` or `#rrggbb`). */
  customBackground?: string;
  padding?: "none" | "sm" | "md" | "lg";
  border?: "none" | "subtle" | "dashed";
  width?: "full" | "constrained";
  align?: "left" | "center" | "right";
  /** Optional row width / alignment (takes precedence over legacy `width`/`align` when set). */
  rowLayout?: StoryBlockRowLayout;
};

export type StoryContainerBlock = {
  id: string;
  type: "container";
  props: StoryContainerBlockProps;
  children: StoryBlock[];
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
};

export type StoryBlock =
  | StoryRichTextBlock
  | StoryMediaBlock
  | StoryEmbedBlock
  | StoryColumnsBlock
  | StoryDividerBlock
  | StoryContainerBlock;

/**
 * Ordered structural unit: optional `blocks`, optional nested `children` (both may be set).
 * Naming is free-form (e.g. “Chapter 1”, “Acknowledgments”, “Appendix A”).
 */
export type StorySection = {
  id: string;
  title: string;
  /** When true, nested sections are hidden in the outline (editor only). */
  collapsed?: boolean;
  /**
   * For `StoryKind.story` public TOC: narrative chapter vs front/back matter (top-level sections only).
   * Serialized to the first `StorySection` row under a chapter when the outline has nested children.
   */
  isChapter?: boolean;
  blocks: StoryBlock[];
  children?: StorySection[];
};

export type StoryDocument = {
  version: 1;
  id: string;
  title: string;
  /** Per-tree URL slug (`stories.slug`); lowercase hyphenated. */
  slug?: string;
  /**
   * When true, title edits do not rewrite `slug`. Set when the user edits the slug field; cleared when the field is emptied.
   * Omitted on older drafts; migration treats a non-empty slug as locked.
   */
  slugManuallyEdited?: boolean;
  /**
   * Byline credits (each with its own prefix), e.g. “Written by …” / “Narrated by …”.
   * Preferred over legacy `author` / `authorPrefix*` when non-empty.
   */
  authors?: StoryAuthorCredit[];
  /** @deprecated Use `authors`; retained for older drafts until `migrateStoryDocument` runs. */
  author?: string;
  /** @deprecated Per-credit `authorPrefixMode` on each `StoryAuthorCredit`. */
  authorPrefixMode?: StoryAuthorPrefixMode;
  /** @deprecated Per-credit `authorPrefixCustom` on each `StoryAuthorCredit`. */
  authorPrefixCustom?: string;
  excerpt?: string;
  status: StoryLifecycleStatus;
  /** Narrative type; defaults to `story` when omitted (see `migrateStoryDocument`). */
  kind?: StoryDocumentKind;
  /** Preferred cover/header image (Story Images → Cover). */
  coverImage?: StoryImageMediaRef;
  /** Profile / identity image (Story Images → Profile). When omitted, cover is reused (see `resolveStoryImages`). */
  profileImage?: StoryImageMediaRef;
  /** @deprecated Prefer `coverImage`; retained for older local drafts and Prisma `cover_media_id` mirror. */
  coverMediaId?: string;
  coverMediaKind?: StoryCoverMediaKind;
  /** Free-form tags for cards/search; maps to `stories.tags` / `story_tags` when persisted. */
  tags?: string[];
  /** Albums this story belongs to when synced (`album_stories`); names are for local UI only. */
  linkedAlbums?: { id: string; name: string }[];
  /**
   * Linked tree records (people, families, events). Stored on the draft JSON until a story API exists.
   * Uses the same shape as note links; only `individual`, `family`, and `event` are used in the UI.
   */
  linkedRecords?: SelectedNoteLink[];
  /**
   * Linked places (search/select via admin places API). Omitted in older drafts; treat as `[]` when missing.
   * Server mirror: `story_places` junction (`StoryPlaceLink`: storyId, placeId).
   */
  placeLinks?: StoryLinkedPlace[];
  /** Top-level sections in document order; each may nest `children`. */
  sections: StorySection[];
  updatedAt: string;
  /** Mirrors Prisma `stories.content_version` when loaded from the server. */
  contentVersion?: number;
};

/** Subset of `StoryDocument` fields edited from the Story inspector tab. */
export type StoryDocumentMetaPatch = Partial<
  Pick<
    StoryDocument,
    | "kind"
    | "status"
    | "slug"
    | "slugManuallyEdited"
    | "authors"
    | "author"
    | "authorPrefixMode"
    | "authorPrefixCustom"
    | "coverImage"
    | "profileImage"
    | "coverMediaId"
    | "coverMediaKind"
    | "tags"
    | "linkedAlbums"
    | "linkedRecords"
    | "placeLinks"
  >
>;

export type StoryIndexEntry = {
  id: string;
  title: string;
  updatedAt: string;
  kind?: StoryDocumentKind;
  slug?: string | null;
  /** Omitted in older local indexes; hydrated from the full document on read. */
  status?: StoryLifecycleStatus;
};

export function newStoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
