import type { JSONContent } from "@tiptap/core";
import { EMPTY_STORY_DOC } from "@/components/admin/story-creator/story-tiptap-doc";
import type {
  StoryBlock,
  StoryColumnNestedBlock,
  StoryColumnSlot,
  StoryColumnsBlock,
  StoryContainerBlock,
  StoryDividerBlock,
  StoryEmbedBlock,
  StoryGeneralEmbedKind,
  StoryMediaBlock,
  StoryRichTextBlock,
  StorySplitContentBlock,
  StorySplitSupportBlock,
  StoryTableBlock,
} from "@/lib/admin/story-creator/story-types";
import { newStoryId } from "@/lib/admin/story-creator/story-types";

export function createRichTextBlock(): StoryRichTextBlock {
  return {
    id: newStoryId(),
    type: "richText",
    doc: EMPTY_STORY_DOC,
    preset: "paragraph",
    textPreset: "paragraph",
  };
}

export function createMediaBlock(): StoryMediaBlock {
  return {
    id: newStoryId(),
    type: "media",
    label: "",
    caption: "",
    titlePlacement: "above",
    captionPlacement: "below",
    layoutAlign: "center",
    widthPreset: "large",
    heightPreset: "default",
    fullWidth: false,
    textWrap: false,
    linkMode: "none",
  };
}

/** @deprecated Use {@link createMediaBlock}. */
export function createMediaEmbedBlock(): StoryMediaBlock {
  return createMediaBlock();
}

export function createEmbedBlock(kind: StoryGeneralEmbedKind = "document"): StoryEmbedBlock {
  return {
    id: newStoryId(),
    type: "embed",
    embedKind: kind,
    label: "Embed",
    caption: "",
    titlePlacement: "above",
    captionPlacement: "below",
    layoutAlign: "center",
    widthPreset: "medium",
    heightPreset: "default",
    fullWidth: false,
    textWrap: false,
    linkMode: "none",
  };
}

export function createColumnsBlock(): StoryColumnsBlock {
  return {
    id: newStoryId(),
    type: "columns",
    columnWidthPercents: [50, 50],
    columnGapRem: 1,
    columns: [
      { id: newStoryId(), blocks: [] },
      { id: newStoryId(), blocks: [] },
    ],
  };
}

export function createDividerBlock(opts?: { variant?: StoryDividerBlock["variant"] }): StoryDividerBlock {
  const preset = opts?.variant ?? "line";
  return { id: newStoryId(), type: "divider", preset, variant: preset };
}

/** Native grid table (not TipTap). */
export function createTableBlock(rowCount = 3, columnCount = 3, hasHeaderRow = true): StoryTableBlock {
  const rows = Math.max(1, rowCount);
  const cols = Math.max(1, columnCount);
  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  return {
    id: newStoryId(),
    type: "table",
    hasHeaderRow,
    rowCount: rows,
    columnCount: cols,
    cells,
  };
}

/** Primary text + supporting media/embed rail (wrap layout scaffolded later). */
export function createSplitContentBlock(): StorySplitContentBlock {
  const text = createRichTextBlock();
  return {
    id: newStoryId(),
    type: "splitContent",
    text: { ...text, preset: "paragraph", textPreset: "paragraph" },
    supporting: { id: newStoryId(), blocks: [] },
    supportingSide: "right",
  };
}

export function createContainerBlock(): StoryContainerBlock {
  return {
    id: newStoryId(),
    type: "container",
    props: {
      background: "none",
      padding: "md",
      border: "subtle",
      width: "full",
      align: "left",
    },
    children: [],
  };
}

/** Default first blocks for a new section (layout container wrapping an empty rich text block). */
export function createDefaultSectionBlocks(): StoryBlock[] {
  return [{ ...createContainerBlock(), children: [createRichTextBlock()] }];
}

/** Allowed nested kinds inside a columns cell (no dividers). */
export type StoryColumnNestedInsertKind = "richText" | "media" | "embed" | "columns" | "container";

export function createColumnNestedBlock(kind: StoryColumnNestedInsertKind): StoryColumnNestedBlock {
  switch (kind) {
    case "richText":
      return createRichTextBlock();
    case "media":
      return createMediaBlock();
    case "embed":
      return createEmbedBlock();
    case "columns":
      return createColumnsBlock();
    case "container":
      return createContainerBlock();
  }
}

export type StoryInsertKind = "richText" | "media" | "embed" | "columns" | "divider" | "container";

export function createStoryBlock(kind: StoryInsertKind): StoryBlock {
  switch (kind) {
    case "richText":
      return createRichTextBlock();
    case "media":
      return createMediaBlock();
    case "embed":
      return createEmbedBlock();
    case "columns":
      return createColumnsBlock();
    case "divider":
      return createDividerBlock();
    case "container":
      return createContainerBlock();
  }
}

export function duplicateJsonContent(doc: unknown): JSONContent {
  return structuredClone(doc ?? EMPTY_STORY_DOC) as JSONContent;
}

function cloneColumnSlot(slot: StoryColumnSlot): StoryColumnSlot {
  return {
    id: newStoryId(),
    stackJustify: slot.stackJustify,
    stackGapRem: slot.stackGapRem,
    blocks: slot.blocks.map(cloneColumnNestedBlock),
  };
}

/** Deep clone with new ids (nested columns, rich text doc, etc.). */
export function cloneColumnNestedBlock(nb: StoryColumnNestedBlock): StoryColumnNestedBlock {
  switch (nb.type) {
    case "richText":
      return {
        id: newStoryId(),
        type: "richText",
        doc: duplicateJsonContent(nb.doc),
        rowLayout: nb.rowLayout ? { ...nb.rowLayout } : undefined,
        design: nb.design ? { ...nb.design } : undefined,
        dateAnnotation: nb.dateAnnotation,
        preset: nb.preset,
        textPreset: nb.textPreset,
        headingLevel: nb.headingLevel,
        listVariant: nb.listVariant,
        quoteAttribution: nb.quoteAttribution,
        quoteStyle: nb.quoteStyle,
        verseSpacing: nb.verseSpacing,
      };
    case "media":
      return { ...nb, id: newStoryId() };
    case "embed":
      return { ...nb, id: newStoryId() };
    case "columns":
      return {
        ...nb,
        id: newStoryId(),
        columnWidthPercents: nb.columnWidthPercents,
        columnGapRem: nb.columnGapRem,
        columns: [cloneColumnSlot(nb.columns[0]), cloneColumnSlot(nb.columns[1])],
      };
    case "container":
      return {
        ...nb,
        id: newStoryId(),
        props: { ...nb.props },
        children: nb.children.map(cloneStoryBlock),
      };
    case "table":
      return {
        ...nb,
        id: newStoryId(),
        cells: nb.cells.map((row) => [...row]),
        design: nb.design ? { ...nb.design } : undefined,
      };
    case "splitContent":
      return {
        ...nb,
        id: newStoryId(),
        text: cloneColumnNestedBlock(nb.text) as StoryRichTextBlock,
        supporting: {
          ...nb.supporting,
          id: newStoryId(),
          blocks: nb.supporting.blocks.map((b) => cloneSplitSupportBlock(b)),
        },
        supportingSide: nb.supportingSide,
        design: nb.design ? { ...nb.design } : undefined,
        dateAnnotation: nb.dateAnnotation,
      };
  }
}

function cloneSplitSupportBlock(b: StorySplitSupportBlock): StorySplitSupportBlock {
  return cloneColumnNestedBlock(b as StoryColumnNestedBlock) as StorySplitSupportBlock;
}

/** Deep clone of a section-level block with new ids. */
export function cloneStoryBlock(block: StoryBlock): StoryBlock {
  switch (block.type) {
    case "richText":
      return {
        id: newStoryId(),
        type: "richText",
        doc: duplicateJsonContent(block.doc),
        rowLayout: block.rowLayout ? { ...block.rowLayout } : undefined,
        design: block.design ? { ...block.design } : undefined,
        dateAnnotation: block.dateAnnotation,
        preset: block.preset,
        textPreset: block.textPreset,
        headingLevel: block.headingLevel,
        listVariant: block.listVariant,
        quoteAttribution: block.quoteAttribution,
        quoteStyle: block.quoteStyle,
        verseSpacing: block.verseSpacing,
      };
    case "media":
      return { ...block, id: newStoryId() };
    case "embed":
      return { ...block, id: newStoryId() };
    case "divider": {
      const pr = block.preset ?? block.variant ?? "line";
      return {
        id: newStoryId(),
        type: "divider",
        preset: pr,
        variant: pr,
        spacerRem: block.spacerRem,
        rowLayout: block.rowLayout ? { ...block.rowLayout } : undefined,
        dividerThicknessPx: block.dividerThicknessPx,
        ornamentalStyle: block.ornamentalStyle,
        design: block.design ? { ...block.design } : undefined,
      };
    }
    case "columns":
      return {
        ...block,
        id: newStoryId(),
        columnWidthPercents: block.columnWidthPercents,
        columnGapRem: block.columnGapRem,
        columns: [cloneColumnSlot(block.columns[0]), cloneColumnSlot(block.columns[1])],
        design: block.design ? { ...block.design } : undefined,
      };
    case "container":
      return {
        ...block,
        id: newStoryId(),
        props: { ...block.props },
        children: block.children.map(cloneStoryBlock),
        design: block.design ? { ...block.design } : undefined,
      };
    case "table":
      return {
        ...block,
        id: newStoryId(),
        cells: block.cells.map((row) => [...row]),
        design: block.design ? { ...block.design } : undefined,
      };
    case "splitContent":
      return cloneColumnNestedBlock(block) as StoryBlock;
  }
}
