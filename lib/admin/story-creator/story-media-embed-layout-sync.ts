import { effectiveRowLayout, mergeStoryRowLayout } from "@/lib/admin/story-creator/story-block-layout";
import type {
  StoryBlockRowAlignment,
  StoryBlockRowLayout,
  StoryBlockWidthMode,
  StoryEmbedBlock,
  StoryEmbedLayoutAlign,
  StoryEmbedWidthPreset,
  StoryMediaBlock,
} from "@/lib/admin/story-creator/story-types";

export function legacyWidthPresetToWidthMode(preset: StoryEmbedWidthPreset | undefined): StoryBlockWidthMode {
  switch (preset ?? "large") {
    case "full":
      return "full";
    case "large":
      return "wide";
    case "content":
      return "medium";
    case "medium":
      return "medium";
    case "small":
      return "narrow";
    default:
      return "full";
  }
}

export function widthModeToLegacyWidthPreset(mode: StoryBlockWidthMode | undefined): StoryEmbedWidthPreset {
  switch (mode ?? "full") {
    case "full":
      return "full";
    case "wide":
      return "large";
    case "medium":
      return "medium";
    case "narrow":
      return "small";
    case "custom":
      return "content";
    default:
      return "large";
  }
}

export function layoutAlignToRowAlignment(la: StoryEmbedLayoutAlign | undefined): StoryBlockRowAlignment {
  if (la === "left" || la === "right" || la === "center") return la;
  return "center";
}

export function rowAlignmentToLayoutAlign(ra: StoryBlockRowAlignment | undefined): StoryEmbedLayoutAlign {
  const r = ra ?? "center";
  if (r === "left" || r === "right" || r === "center") return r;
  return "center";
}

type LegacyMediaEmbedFields = Pick<StoryMediaBlock, "widthPreset" | "textWrap" | "fullWidth" | "layoutAlign">;

function legacyShape(block: StoryMediaBlock | StoryEmbedBlock): LegacyMediaEmbedFields {
  return {
    widthPreset: block.widthPreset,
    textWrap: block.textWrap,
    fullWidth: block.fullWidth,
    layoutAlign: block.layoutAlign,
  };
}

/**
 * Row layout shown in the inspector: explicit `rowLayout` wins; otherwise infer from legacy
 * `widthPreset` / `fullWidth` / `textWrap` / `layoutAlign` so older blocks stay editable.
 */
export function effectiveMediaEmbedInspectorRowLayout(block: StoryMediaBlock | StoryEmbedBlock): StoryBlockRowLayout {
  const hasExplicitRow =
    block.rowLayout != null &&
    (block.rowLayout.widthMode != null ||
      block.rowLayout.displayMode != null ||
      block.rowLayout.alignment != null ||
      block.rowLayout.float != null ||
      block.rowLayout.widthValue != null);
  if (hasExplicitRow) {
    return effectiveRowLayout(block.rowLayout);
  }
  const l = legacyShape(block);
  const widthMode = l.fullWidth ? "full" : legacyWidthPresetToWidthMode(l.widthPreset);
  return effectiveRowLayout({
    widthMode,
    alignment: layoutAlignToRowAlignment(l.layoutAlign),
    displayMode: l.textWrap ? "float" : "block",
    float: l.textWrap ? "left" : undefined,
  });
}

/** Keep legacy fields aligned with canonical `rowLayout` for preview / future renderers. */
export function legacyFieldsSyncedFromRowLayout(rl: StoryBlockRowLayout): Pick<
  StoryMediaBlock,
  "widthPreset" | "textWrap" | "fullWidth" | "layoutAlign"
> {
  const e = effectiveRowLayout(rl);
  return {
    widthPreset: widthModeToLegacyWidthPreset(e.widthMode),
    textWrap: e.displayMode === "float",
    fullWidth: e.widthMode === "full",
    layoutAlign: rowAlignmentToLayoutAlign(e.alignment),
  };
}

export function mergeMediaEmbedRowLayoutPatch(
  block: StoryMediaBlock | StoryEmbedBlock,
  patch: Partial<StoryBlockRowLayout>,
): { rowLayout: StoryBlockRowLayout } & Pick<StoryMediaBlock, "widthPreset" | "textWrap" | "fullWidth" | "layoutAlign"> {
  const base = effectiveMediaEmbedInspectorRowLayout(block);
  const merged = mergeStoryRowLayout(base, patch);
  const legacy = legacyFieldsSyncedFromRowLayout(merged);
  return { rowLayout: merged, ...legacy };
}

/** When persisting migrated docs, add `rowLayout` if the block only had legacy layout fields. */
export function ensureMediaEmbedRowLayoutMigrated(block: StoryMediaBlock | StoryEmbedBlock): StoryMediaBlock | StoryEmbedBlock {
  const hasExplicitRow =
    block.rowLayout != null &&
    (block.rowLayout.widthMode != null ||
      block.rowLayout.displayMode != null ||
      block.rowLayout.alignment != null ||
      block.rowLayout.float != null ||
      block.rowLayout.widthValue != null);
  if (hasExplicitRow) return block;
  const rl = effectiveMediaEmbedInspectorRowLayout(block);
  const legacy = legacyFieldsSyncedFromRowLayout(rl);
  return { ...block, rowLayout: rl, ...legacy } as StoryMediaBlock | StoryEmbedBlock;
}
