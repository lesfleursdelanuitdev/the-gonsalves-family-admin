import {
  effectiveMediaEmbedInspectorRowLayout,
  effectiveRowLayout,
  layoutAlignToRowAlignment,
  legacyWidthPresetToWidthMode,
  mergeStoryRowLayout,
} from "@/lib/admin/story-creator/story-block-layout";
import type {
  StoryBlockRowAlignment,
  StoryBlockRowLayout,
  StoryBlockWidthMode,
  StoryEmbedBlock,
  StoryEmbedLayoutAlign,
  StoryEmbedWidthPreset,
  StoryMediaBlock,
} from "@/lib/admin/story-creator/story-types";

export { legacyWidthPresetToWidthMode, layoutAlignToRowAlignment, effectiveMediaEmbedInspectorRowLayout } from "@/lib/admin/story-creator/story-block-layout";

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

export function rowAlignmentToLayoutAlign(ra: StoryBlockRowAlignment | undefined): StoryEmbedLayoutAlign {
  const r = ra ?? "center";
  if (r === "left" || r === "right" || r === "center") return r;
  return "center";
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

/**
 * Standalone media/embed inspector: size + column alignment only.
 * Clears wrap/float row semantics while syncing `rowLayout` and legacy width/align fields.
 */
export function standaloneMediaEmbedLayoutPatch(
  block: StoryMediaBlock | StoryEmbedBlock,
  opts: { widthPreset?: StoryEmbedWidthPreset; layoutAlign?: StoryEmbedLayoutAlign },
): { rowLayout: StoryBlockRowLayout } & Pick<StoryMediaBlock, "widthPreset" | "textWrap" | "fullWidth" | "layoutAlign"> {
  const widthPreset = opts.widthPreset ?? block.widthPreset;
  const layoutAlign = opts.layoutAlign ?? block.layoutAlign;
  const widthMode = legacyWidthPresetToWidthMode(widthPreset);
  const alignment = layoutAlignToRowAlignment(layoutAlign);
  const base = effectiveMediaEmbedInspectorRowLayout(block);
  const merged = mergeStoryRowLayout(base, {
    widthMode,
    alignment,
    displayMode: "block",
    float: undefined,
  });
  const e = effectiveRowLayout(merged);
  const legacy = legacyFieldsSyncedFromRowLayout(e);
  return { rowLayout: e, ...legacy };
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
