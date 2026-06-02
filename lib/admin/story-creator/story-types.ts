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
  /** GEDCOM xref of the linked individual in the tree (e.g. "@I001@"). */
  personXref?: string;
  /** Database UUID of the linked individual — used for profile page links. */
  personId?: string;
};

/** Row-level width and float behavior for story blocks (editor + preview). */
export type StoryBlockWidthMode = "full" | "wide" | "medium" | "narrow" | "custom";

export type StoryBlockWidthUnit = "%" | "px";

export type StoryBlockRowAlignment = "left" | "center" | "right";
export type StoryVerseLineLayout = "normal" | "staggered";

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

export type StoryBlockPlaceAnnotation = {
  placeId?: string;
  label: string;
};

/** Semantic text preset (Add Block); TipTap remains the inline engine inside `doc`. */
export type StoryRichTextTextPreset = "paragraph" | "heading" | "list" | "verse" | "quote";

export type StoryFlowDisplayMode = "block" | "wrapped";
export type StoryFlowAlign = "left" | "right" | "center";
export type StoryFlowSize = "small" | "medium" | "large" | "full";

export type StoryFlowMediaAttrs = {
  id: string;
  mediaId: string;
  mediaType?: "image" | "video" | "audio" | "document";
  title?: string;
  caption?: string;
  alt?: string;
  credit?: string;
  displayMode: StoryFlowDisplayMode;
  align: StoryFlowAlign;
  size: StoryFlowSize;
};

export type StoryFlowEmbedKind =
  | "timeline"
  | "tree"
  | "gallery"
  | "map"
  | "personSpotlight"
  | "familyGroup"
  | "event"
  | "recipe";

export type StoryFlowEmbedPresentation = {
  chrome?: "none" | "minimal" | "full";
  controls?: boolean;
};

export type TreeFlowEmbedData = StoryTreeEmbedData;
export type PersonSpotlightFlowEmbedData = StoryPersonSpotlightEmbedData;
export type GalleryFlowEmbedData = StoryGalleryEmbedData;
export type MapFlowEmbedData = StoryMapEmbedData;
export type TimelineFlowEmbedData = StoryTimelineEmbedData;

export type StoryFlowEmbedAttrsCommon = {
  id: string;
  title?: string;
  caption?: string;
  displayMode: StoryFlowDisplayMode;
  align: StoryFlowAlign;
  size: StoryFlowSize;
  presentation?: StoryFlowEmbedPresentation;
};

export type StoryFlowEmbedAttrs = StoryFlowEmbedAttrsCommon &
  (
    | { embedKind: "tree"; data: TreeFlowEmbedData }
    | { embedKind: "timeline"; data: TimelineFlowEmbedData }
    | { embedKind: "gallery"; data: GalleryFlowEmbedData }
    | { embedKind: "map"; data: MapFlowEmbedData }
    | { embedKind: "personSpotlight"; data: PersonSpotlightFlowEmbedData }
    | { embedKind: "familyGroup"; data: StoryFamilyGroupEmbedData | Record<string, unknown> }
    | { embedKind: "event"; data: StoryEventEmbedData | Record<string, unknown> }
    | { embedKind: "recipe"; data: StoryRecipeEmbedData | Record<string, unknown> }
  );

/** Optional layout preset for containers created from Add Block. */
export type StoryContainerPreset = "default" | "card" | "callout" | "hero" | "quote";

/** Content width inside the row wrapper (max-width + horizontal alignment). */
export type StoryContainerWidth = "narrow" | "normal" | "wide" | "full";

/** Divider / spacer preset values (stored on `preset` and mirrored on `variant` for compatibility). */
export type StoryDividerVariant = "line" | "spacer" | "ornamental" | "sectionBreak";

/** Matches Prisma `StoryKind` — used in local drafts until server sync. */
export type StoryDocumentKind = "story" | "article" | "post" | "folklore";

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
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
  /** Canonical semantic preset (paragraph, heading, list, quote, verse). New writes use this only. */
  preset?: StoryRichTextTextPreset;
  /**
   * @deprecated Legacy alias of {@link StoryRichTextBlock.preset}. Still read by {@link getStoryRichTextPreset};
   * migration and patches strip it in favor of `preset`.
   */
  textPreset?: StoryRichTextTextPreset;
  /** When preset is `heading`, semantic level (mirrors TipTap `heading` attrs.level, h1–h6). */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** When preset is `list`, preferred list style for starter docs. */
  listVariant?: "bullet" | "ordered";
  /** When preset is `quote`, optional attribution (published later). */
  quoteAttribution?: string;
  /** When preset is `quote`, layout flavor in the editor / preview. */
  quoteStyle?: "simple" | "card";
  /** When preset is `verse`, vertical rhythm between lines in the editor. */
  verseSpacing?: "compact" | "relaxed";
  /** When preset is `verse`, optional title shown above the poem/body. */
  verseTitle?: string;
  /** When preset is `verse`, inspector-managed multiline content. Falls back to `doc` for older drafts. */
  verseContent?: string;
  /** When preset is `verse`, title text alignment. */
  verseTitleAlign?: StoryBlockRowAlignment;
  /** When preset is `verse`, body text alignment. */
  verseContentAlign?: StoryBlockRowAlignment;
  /** When preset is `verse`, optional staggered line offsets for the body. */
  verseLineLayout?: StoryVerseLineLayout;
  /**
   * When true, this block was created as a locked heading (e.g. full-screen Add block → Heading).
   * The text preset cannot be changed away from `heading`; heading level may still be edited.
   */
  headingPresetLocked?: boolean;
  /**
   * When true, this block was inserted as a List from Add block. The text preset cannot be changed away from `list`;
   * list style (bullets vs numbered) may still be edited.
   */
  listPresetLocked?: boolean;
};

/** Raster / video / audio attached from the media library (picker, thumbnail, captions). */
export type StoryMediaBlock = {
  id: string;
  type: "media";
  mediaId?: string;
  /** Display title for this block (optional). Shown as "Untitled media" when empty. */
  label: string;
  caption?: string;
  /** When true, keep the title editable but never render it in story output. */
  hideTitle?: boolean;
  /** When true, keep the caption editable but never render it in story output. */
  hideCaption?: boolean;
  /** Position of the title relative to the media frame. Defaults to `above` when omitted. */
  titlePlacement?: StoryBlockTextPlacement;
  /** Position of the caption relative to the media frame. Defaults to `below` when omitted. */
  captionPlacement?: StoryBlockTextPlacement;
  /**
   * @deprecated Use `rowLayout.alignment` instead.
   * Kept for backward compatibility with saved stories; `rowLayout` is canonical.
   * New blocks should not set this directly — see `mergeMediaEmbedRowLayoutPatch`.
   */
  layoutAlign?: StoryEmbedLayoutAlign;
  /**
   * @deprecated Use `rowLayout.widthMode` instead.
   * Kept for backward compatibility; `rowLayout` is canonical.
   */
  widthPreset?: StoryEmbedWidthPreset;
  heightPreset?: StoryEmbedHeightPreset;
  /**
   * @deprecated Use `rowLayout.widthMode === "full"` instead.
   * Wrapping behavior belongs to `splitContent` blocks, not standalone media.
   */
  fullWidth?: boolean;
  /**
   * @deprecated Use `rowLayout.displayMode === "float"` (via `splitContent`) instead.
   * Float-with-text wrapping is not a standalone media block concern.
   */
  textWrap?: boolean;
  linkMode?: StoryEmbedLinkMode;
  /** Row width, alignment, and optional float-with-text layout. Canonical source of truth. */
  rowLayout?: StoryBlockRowLayout;
  /** Explicit crop height in px. When set, the image fills the frame with object-cover. Absent = natural aspect ratio. */
  heightPx?: number;
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
};

/** Non-media embeds: maps, timelines, trees, documents, graphs, and genealogy UI scaffolds. */
export type StoryGeneralEmbedKind =
  | "document"
  | "timeline"
  | "map"
  | "tree"
  | "graph"
  | "gallery"
  | "personSpotlight"
  | "familyGroup"
  | "event"
  | "recipe";

/** Layout for media / embed blocks (theme-controlled presets, not freeform CSS). */
export type StoryEmbedLayoutAlign = "above" | "below" | "left" | "right" | "wrapped" | "center" | "full";

/** Where title or caption sits relative to the media / embed frame (each field is independent). */
export type StoryBlockTextPlacement = "above" | "below" | "left" | "right";

export type StoryEmbedWidthPreset = "small" | "medium" | "large" | "content" | "full";

/** Theme-controlled vertical footprint for placeholders (no freeform CSS). */
export type StoryEmbedHeightPreset = "auto" | "compact" | "default" | "tall" | "hero";

export type StoryEmbedLinkMode = "none" | "same_window" | "new_tab";

export type StoryEmbedSubjectType =
  | "individual"
  | "family"
  | "event"
  | "place"
  | "album"
  | "media"
  | "tree"
  | "note"
  | "custom";

export type StoryEmbedSubject = {
  type: StoryEmbedSubjectType;
  id?: string;
  xref?: string;
  label?: string;
};

export type StoryEmbedPresentation = {
  chrome?: "none" | "minimal" | "full";
  controls?: boolean;
};

/** Mirrors `PersonCardVariant` from the tree viewer; renderer defaults to `full` when absent. */
export type StoryTreeCardVariant = "full" | "compact-name" | "compact-avatar";

/** Mirrors `PersonCardLayout` from the tree viewer; only meaningful when `cardVariant` is `full`. */
export type StoryTreeCardLayout =
  | "avatarTopActionsBottom"
  | "avatarLeftActionsRight"
  | "avatarLeftActionsBottom"
  | "avatarTopActionsRight"
  | "avatarTopMobileMenu"
  | "avatarLeftMobileMenu";

/** Mirrors `PersonCompactCardSize`; only meaningful when `cardVariant` is a compact variant. */
export type StoryTreeCompactCardSize = "large" | "medium" | "small" | "extra-small";

export type StoryTreeEmbedData = {
  rootPersonId?: string;
  rootPersonXref?: string;
  rootPersonLabel?: string;
  generations: number;
  chartType?: "pedigree" | "verticalPedigree" | "descendancy" | "fan";
  /** Card style override. When absent, the renderer picks its own default. */
  cardVariant?: StoryTreeCardVariant;
  /** Full-card layout override. Only applied when `cardVariant` is `full` or absent. */
  cardLayout?: StoryTreeCardLayout;
  /** Compact card size override. Only applied when `cardVariant` is a compact variant. */
  compactCardSize?: StoryTreeCompactCardSize;
};

export type StoryPersonSpotlightField =
  | "profileImage"
  | "name"
  | "birthDate"
  | "deathDate"
  | "age"
  | "lifespan"
  | "birthPlace"
  | "deathPlace"
  | "parents"
  | "spouses"
  | "children"
  | "custom";

export type StoryPersonSpotlightEmbedData = {
  personId?: string;
  personXref?: string;
  personLabel?: string;
  fields: StoryPersonSpotlightField[];
  customFields?: Array<{
    label: string;
    valuePath?: string;
    value?: string;
  }>;
};

export type StoryGalleryEmbedData = {
  sourceType: "album" | "personMedia" | "familyMedia" | "eventMedia" | "tag" | "custom";
  sourceId?: string;
  sourceLabel?: string;
  limit?: number;
};

export type StoryMapEmbedData = {
  eventIds: string[];
  eventXrefs?: string[];
  eventLabels?: Record<string, string>;
  mapMode?: "events" | "lifeRoute" | "familyMigration" | "custom";
};

export type TimelineRelationship = "parents" | "siblings" | "children" | "grandchildren";

export type TimelineEventRuleFilters = {
  eventTypes?: string[];
  startYear?: number;
  endYear?: number;
};

export type TimelineEventRule =
  | { kind: "personEvents"; personId: string; personLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "familyEvents"; familyId: string; familyLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "memberEvents"; familyId: string; familyLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "noteEvents"; noteId: string; noteLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "relativeEvents"; personId: string; personLabel?: string; relationships: TimelineRelationship[]; filters?: TimelineEventRuleFilters };

export type TimelineGlobalFilters = {
  eventTypes?: string[];
  startYear?: number;
  endYear?: number;
  includeUndated?: boolean;
};

export type StoryTimelineEmbedData = {
  /** Composite rule-based event source. When present, legacy sourceType fields are ignored. */
  rules?: TimelineEventRule[];
  globalFilters?: TimelineGlobalFilters;
  /** @deprecated Use `rules`. Retained for existing local drafts. */
  sourceType?: "personEvents" | "familyEvents" | "noteEvents" | "selectedEvents" | "storyEvents" | "custom";
  /** @deprecated Use `rules`. */
  sourceId?: string;
  /** @deprecated Use `rules`. */
  sourceXref?: string;
  /** @deprecated Use `rules`. */
  sourceLabel?: string;
  /** @deprecated Use `rules`. */
  eventIds?: string[];
  /** @deprecated Use `rules`. */
  eventXrefs?: string[];
  /** @deprecated Use `rules`. */
  eventLabels?: Record<string, string>;
  /** @deprecated Use `globalFilters`. */
  timelineMode?: "life" | "family" | "note" | "story" | "custom";
  /** @deprecated Use `globalFilters`. */
  filters?: {
    eventTypes?: string[];
    startYear?: number;
    endYear?: number;
    includeUndated?: boolean;
  };
};

export type RecipeIngredient = {
  id: string;
  amount?: string;
  amountNum?: number;
  unit?: string;
  name: string;
  note?: string;
};

export type RecipeIngredientGroup = {
  id: string;
  title?: string;
  items: RecipeIngredient[];
};

export type RecipeStep = {
  id: string;
  text: string;
  tip?: string;
  stepMedia?: StoryImageMediaRef;
};

export type RecipeStepGroup = {
  id: string;
  title?: string;
  steps: RecipeStep[];
};

export type StoryRecipeEmbedData = {
  yield?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  difficulty?: "easy" | "medium" | "hard";
  cuisine?: string;
  source?: string;
  ingredientGroups: RecipeIngredientGroup[];
  stepGroups: RecipeStepGroup[];
  notes?: string;
  dietaryTags?: string[];
};

export type StoryEventEmbedData = {
  eventId?: string;
  eventXref?: string;
  eventLabel?: string;
  fields?: Array<"type" | "date" | "place" | "description" | "people" | "custom">;
};

export type StoryFamilyGroupEmbedData = {
  familyId?: string;
  familyXref?: string;
  familyLabel?: string;
  fields?: Array<"partners" | "children" | "marriage" | "events" | "custom">;
};

export type StoryDocumentEmbedData = {
  documentId?: string;
  documentLabel?: string;
};

export type StoryGraphEmbedData = {
  subjectId?: string;
  subjectLabel?: string;
};

export type StoryEmbedDataByKind = {
  document: StoryDocumentEmbedData;
  timeline: StoryTimelineEmbedData;
  map: StoryMapEmbedData;
  tree: StoryTreeEmbedData;
  graph: StoryGraphEmbedData;
  gallery: StoryGalleryEmbedData;
  personSpotlight: StoryPersonSpotlightEmbedData;
  familyGroup: StoryFamilyGroupEmbedData;
  event: StoryEventEmbedData;
  recipe: StoryRecipeEmbedData;
};

export type StoryTimelineScope = "individual" | "family" | "note";
export type StoryTimelineOrient = "toggle" | "vertical" | "horizontal";
export type StoryTimelineAnim = "fade" | "slide" | "pop" | "none";
export type StoryTimelineStaggerV = "staggered" | "left" | "right";
export type StoryTimelineStaggerH = "staggered" | "top" | "bottom";
export type StoryTimelineRenderer = "html" | "svg";
export type StoryTimelineViewMode = "single" | "timeline-cols" | "grid-cols" | "spine-cols";
export type StoryTimelineColumnChunkMode = "by-events-per-column" | "by-column-count";
export type StoryTimelinePerCol = 5 | 8 | 10 | 15 | 20;
export type StoryTimelineNumColumns = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** How the timeline scroll viewport width is interpreted (matches standalone timeline URL state). */
export type StoryTimelinePreviewWidthUnit = "px" | "pct";

export type StoryEmbedBlockBase = {
  id: string;
  type: "embed";
  /** Canonical editorial title. `label` is kept as a legacy alias for existing drafts. */
  title?: string;
  /** Canonical subject/source for the embed. */
  subject?: StoryEmbedSubject;
  /** Minimal presentation intent. Final styling belongs to the renderer/public site. */
  presentation?: StoryEmbedPresentation;
  /** @deprecated Use `title`. Kept for existing local drafts and older renderers. */
  label: string;
  /** @deprecated Prefer kind-specific semantic data or `caption`/`title`. */
  sublabel?: string;
  caption?: string;
  /** When true, keep the title editable but never render it in story output. */
  hideTitle?: boolean;
  /** When true, keep the caption editable but never render it in story output. */
  hideCaption?: boolean;
  /** @deprecated Admin preview-only placement. Public renderers should choose presentation. */
  titlePlacement?: StoryBlockTextPlacement;
  /** @deprecated Admin preview-only placement. Public renderers should choose presentation. */
  captionPlacement?: StoryBlockTextPlacement;
  /** @deprecated Media-era layout alias; prefer renderer-driven presentation. */
  layoutAlign?: StoryEmbedLayoutAlign;
  /** @deprecated Media-era layout alias; prefer renderer-driven presentation. */
  widthPreset?: StoryEmbedWidthPreset;
  /** @deprecated Admin preview placeholder sizing. */
  heightPreset?: StoryEmbedHeightPreset;
  /** @deprecated Media-era layout alias; prefer renderer-driven presentation. */
  fullWidth?: boolean;
  /** @deprecated Media-era layout alias; prefer renderer-driven presentation. */
  textWrap?: boolean;
  /** @deprecated Prefer `presentation.controls` or kind-specific public behavior. */
  linkMode?: StoryEmbedLinkMode;
  /** Optional fixed embed frame height in px (timeline embed). */
  heightPx?: number;
  /** Timeline subject scope (timeline embed only). */
  scope?: StoryTimelineScope | null;
  /** UUID of selected individual/family/note (timeline embed only). */
  entityId?: string | null;
  /** Timeline presentation options (timeline embed only). */
  viewMode?: StoryTimelineViewMode;
  orient?: StoryTimelineOrient;
  activeView?: "vertical" | "horizontal";
  anim?: StoryTimelineAnim;
  vStyle?: StoryTimelineStaggerV;
  hStyle?: StoryTimelineStaggerH;
  pag?: boolean;
  perPage?: 5 | 8 | 12 | 20;
  autoplayPxPerSec?: number;
  autoplayLoop?: boolean;
  showImages?: boolean;
  animRevealMinRatio?: number;
  renderer?: StoryTimelineRenderer;
  perCol?: StoryTimelinePerCol;
  numColumns?: StoryTimelineNumColumns;
  columnChunkMode?: StoryTimelineColumnChunkMode;
  cardWidthPx?: 200 | 260 | 320;
  gapPx?: number;
  showArrows?: boolean;
  /** Width of the timeline embed container as a percentage (20–100). Only applies in vertical single view. */
  embedWidthPct?: number;
  /** Horizontal alignment of the timeline embed when embedWidthPct < 100. Only applies in vertical single view. */
  embedAlign?: "left" | "center" | "right";
  /** Max timeline viewport width in px when `timelinePreviewWidthUnit` is `px`. */
  timelineWidthPx?: number;
  /** Viewport width as % of the embed frame when `timelinePreviewWidthUnit` is `pct`. */
  timelineWidthPct?: number;
  timelinePreviewWidthUnit?: StoryTimelinePreviewWidthUnit;
  /** When true, readers see Play / Pause / Start over on the embed (pagination must be off). */
  timelineShowPlaybackControls?: boolean;
  rowLayout?: StoryBlockRowLayout;
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
};

export type StoryDocumentEmbedBlock = StoryEmbedBlockBase & { embedKind: "document"; data?: StoryDocumentEmbedData };
export type StoryTimelineEmbedBlock = StoryEmbedBlockBase & { embedKind: "timeline"; data?: StoryTimelineEmbedData };
export type StoryMapEmbedBlock = StoryEmbedBlockBase & { embedKind: "map"; data?: StoryMapEmbedData };
export type StoryTreeEmbedBlock = StoryEmbedBlockBase & { embedKind: "tree"; data?: StoryTreeEmbedData };
export type StoryGraphEmbedBlock = StoryEmbedBlockBase & { embedKind: "graph"; data?: StoryGraphEmbedData };
export type StoryGalleryEmbedBlock = StoryEmbedBlockBase & { embedKind: "gallery"; data?: StoryGalleryEmbedData };
export type StoryPersonSpotlightEmbedBlock = StoryEmbedBlockBase & {
  embedKind: "personSpotlight";
  data?: StoryPersonSpotlightEmbedData;
};
export type StoryFamilyGroupEmbedBlock = StoryEmbedBlockBase & { embedKind: "familyGroup"; data?: StoryFamilyGroupEmbedData };
export type StoryEventEmbedBlock = StoryEmbedBlockBase & { embedKind: "event"; data?: StoryEventEmbedData };
export type StoryRecipeEmbedBlock = StoryEmbedBlockBase & { embedKind: "recipe"; data?: StoryRecipeEmbedData };

export type StoryEmbedBlock =
  | StoryDocumentEmbedBlock
  | StoryTimelineEmbedBlock
  | StoryMapEmbedBlock
  | StoryTreeEmbedBlock
  | StoryGraphEmbedBlock
  | StoryGalleryEmbedBlock
  | StoryPersonSpotlightEmbedBlock
  | StoryFamilyGroupEmbedBlock
  | StoryEventEmbedBlock
  | StoryRecipeEmbedBlock;

export type StoryTimelineEmbedPayload = Pick<
  StoryEmbedBlock,
  | "scope"
  | "entityId"
  | "viewMode"
  | "orient"
  | "activeView"
  | "anim"
  | "vStyle"
  | "hStyle"
  | "pag"
  | "perPage"
  | "autoplayPxPerSec"
  | "autoplayLoop"
  | "showImages"
  | "animRevealMinRatio"
  | "renderer"
  | "perCol"
  | "numColumns"
  | "columnChunkMode"
  | "cardWidthPx"
  | "gapPx"
  | "showArrows"
  | "heightPx"
  | "timelineWidthPx"
  | "timelineWidthPct"
  | "timelinePreviewWidthUnit"
  | "timelineShowPlaybackControls"
> & {
  /** Rule-based event source (EventsListPicker custom/noteEvents mode). */
  rules?: TimelineEventRule[];
  globalFilters?: TimelineGlobalFilters;
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
  | StoryContainerBlock
  | StoryTableBlock
  | StorySplitContentBlock;

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

export type StoryColumnsMobileBehavior = "stackLeftFirst" | "stackRightFirst" | "keepSideBySide";

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
  /** Narrow-screen behavior. Defaults to stackLeftFirst for saved stories without this field. */
  mobileBehavior?: StoryColumnsMobileBehavior;
  /** When false, per-column stack overrides stay saved but render as shared defaults. */
  advancedColumnLayoutEnabled?: boolean;
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
};

/** Custom grid table (not TipTap table). */
export type StoryTableBlock = {
  id: string;
  type: "table";
  /** Whether to render an extra top header row (`<th scope="col">` cells). */
  hasHeaderRow?: boolean;
  /** Whether to render an extra first header column (`<th scope="row">` cells). */
  hasHeaderColumn?: boolean;
  /** Body column count (excludes optional header column). */
  columnCount: number;
  /** Body row count (excludes optional header row). */
  rowCount: number;
  /** Row-major rich-text cells including any optional header row/column. */
  cells: JSONContent[][];
  /** Block width as a percentage of its container. Default: 100. */
  widthPct?: number;
  /** Horizontal alignment when `widthPct < 100`. Default: "center". */
  widthAlign?: "left" | "center" | "right";
  /** Per-column widths as percentages summing to 100. Absent = equal distribution. */
  columnWidths?: number[];
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
};

/** Blocks allowed in the split "supporting" rail. */
export type StorySplitSupportBlock =
  | StoryRichTextBlock
  | StoryMediaBlock
  | StoryEmbedBlock
  | StoryTableBlock;

/** One primary text flow plus a supporting stack (media/embed/table). */
export type StorySplitSupportingSlot = {
  id: string;
  blocks: StorySplitSupportBlock[];
};

export type StorySplitContentBlock = {
  id: string;
  type: "splitContent";
  text: StoryRichTextBlock;
  supporting: StorySplitSupportingSlot;
  /** Which side the supporting panel floats to. Default: right. */
  supportingSide?: "left" | "right";
  /** Width of the supporting panel as a percentage (20-50). Default: 33. */
  supportingWidthPct?: number;
  /** Gap between panel and text in rem. Default: 1.5. */
  supportingGapRem?: number;
  /**
   * Vertical float position in preview. Implemented as a margin-top on the
   * floated rail so text before it renders full-width above the drop point.
   * Default: "top" (no margin-top).
   */
  supportingFloatPosition?: "top" | "center" | "bottom";
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
};

export type StoryDividerBlock = {
  id: string;
  type: "divider";
  /** Canonical divider preset; when absent, {@link StoryDividerBlock.variant} is used (migration fills both). */
  preset?: StoryDividerVariant;
  /** @deprecated Prefer {@link StoryDividerBlock.preset}; kept in sync for older readers. */
  variant?: StoryDividerVariant;
  /** When preset is `spacer`, vertical gap in rem (default 2). */
  spacerRem?: number;
  /** Row width / alignment (optional; defaults when omitted). */
  rowLayout?: StoryBlockRowLayout;
  /** Line weight for `line`, `ornamental`, and `sectionBreak` (CSS px, clamped in UI). */
  dividerThicknessPx?: number;
  /** Sub-style when `variant` is `ornamental`. */
  ornamentalStyle?: "dots" | "diamonds";
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
};

const STORY_DIVIDER_VARIANTS: readonly StoryDividerVariant[] = ["line", "spacer", "ornamental", "sectionBreak"];

/** Resolved divider preset (`preset` wins, then `variant`, then `line`). */
export function getStoryDividerPreset(block: Pick<StoryDividerBlock, "preset" | "variant">): StoryDividerVariant {
  const raw = block.preset ?? block.variant;
  if (raw && (STORY_DIVIDER_VARIANTS as readonly string[]).includes(raw)) return raw;
  return "line";
}

/** Canonical rich-text preset (prefers `preset`, then legacy `textPreset`). */
export function getStoryRichTextPreset(block: Pick<StoryRichTextBlock, "preset" | "textPreset">): StoryRichTextTextPreset {
  return block.preset ?? block.textPreset ?? "paragraph";
}

/** Layout-only container; children are full section-level block shapes (recursive). */
export type StoryContainerBlockProps = {
  label?: string;
  background?: "none" | "subtle" | "custom";
  /** When `background` is `custom`, optional CSS color (e.g. `oklch(...)` or `#rrggbb`). */
  customBackground?: string;
  padding?: "none" | "sm" | "md" | "lg";
  border?: "none" | "subtle" | "dashed";
  /** Legacy `"constrained"` is normalized at load to `"normal"`. */
  width?: StoryContainerWidth | "constrained";
  align?: "left" | "center" | "right";
  /** Optional row width / alignment (takes precedence over legacy `width`/`align` when set). */
  rowLayout?: StoryBlockRowLayout;
  /** Canonical layout preset for this container. New writes use this only. */
  preset?: StoryContainerPreset;
  /**
   * @deprecated Legacy alias of {@link StoryContainerBlockProps.preset}. Still read by {@link getStoryContainerPreset};
   * migration and merges strip it in favor of `preset`.
   */
  containerPreset?: StoryContainerPreset;
};

/** Canonical container layout preset (`preset` wins, then legacy `containerPreset`). */
export function getStoryContainerPreset(props: Pick<StoryContainerBlockProps, "preset" | "containerPreset">): StoryContainerPreset {
  return props.preset ?? props.containerPreset ?? "default";
}

/** Normalized content width (runtime default when omitted: `normal`). */
export function resolveStoryContainerWidth(raw: StoryContainerBlockProps["width"] | undefined): StoryContainerWidth {
  if (raw === "narrow" || raw === "normal" || raw === "wide" || raw === "full") return raw;
  if (raw === "constrained") return "normal";
  return "normal";
}

export type StoryContainerBlock = {
  id: string;
  type: "container";
  props: StoryContainerBlockProps;
  children: StoryBlock[];
  design?: StoryBlockDesign;
  dateAnnotation?: StoryBlockDateAnnotation;
  dateAnnotations?: StoryBlockDateAnnotation[];
  placeAnnotations?: StoryBlockPlaceAnnotation[];
  /**
   * When true, this container was inserted as Card / Callout / Hero from the add-block presets;
   * the layout preset cannot be switched to default or quote in the inspector (padding, border, etc. stay editable).
   */
  containerPresetLocked?: boolean;
};

export type StoryBlock =
  | StoryRichTextBlock
  | StoryMediaBlock
  | StoryEmbedBlock
  | StoryColumnsBlock
  | StoryDividerBlock
  | StoryContainerBlock
  | StoryTableBlock
  | StorySplitContentBlock;

/**
 * Ordered structural unit: optional `blocks`, optional nested `children` (both may be set).
 * Naming is free-form (e.g. "Chapter 1", "Acknowledgments", "Appendix A").
 */
/** A single entity associated with a section (person, family, event, or place). */
export type StorySectionEntityLink = {
  id: string;
  entityType: "person" | "family" | "event" | "place";
  entityId: string;
  entityXref?: string;
  label: string;
};

export type StorySection = {
  id: string;
  title: string;
  subtitle?: string;
  /** Hide the title in story body renderers while keeping it available for editor navigation/TOC. */
  hideTitle?: boolean;
  /** Hide the subtitle in story body renderers while keeping it available for editor metadata. */
  hideSubtitle?: boolean;
  /** When true, nested sections are hidden in the outline (editor only). */
  collapsed?: boolean;
  /**
   * For `StoryKind.story` public TOC: narrative chapter vs front/back matter (top-level sections only).
   * Serialized to the first `StorySection` row under a chapter when the outline has nested children.
   */
  isChapter?: boolean;
  /**
   * Page break / discrete page for pagination and print (top-level sections; same first-row serialization as `isChapter`).
   */
  isPage?: boolean;
  blocks: StoryBlock[];
  children?: StorySection[];
  /** Entities (people, families, events, places) that this section discusses. */
  entityLinks?: StorySectionEntityLink[];
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
   * Byline credits (each with its own prefix), e.g. "Written by …" / "Narrated by …".
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
  tags?: string[];
  linkedIndividuals?: { id: string; fullName: string }[];
};

export function newStoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
