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
import { defaultStoryEmbedData, defaultStoryEmbedPresentation, defaultStoryEmbedTitle } from "@/lib/admin/story-creator/story-embed-semantics";
import { newStoryId } from "@/lib/admin/story-creator/story-types";

export function createRichTextBlock(): StoryRichTextBlock {
  return {
    id: newStoryId(),
    type: "richText",
    doc: EMPTY_STORY_DOC,
    preset: "paragraph",
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
  const title = defaultStoryEmbedTitle(kind);
  return {
    id: newStoryId(),
    type: "embed",
    embedKind: kind,
    title,
    label: title,
    caption: "",
    presentation: defaultStoryEmbedPresentation(kind),
    data: defaultStoryEmbedData(kind),
  } as StoryEmbedBlock;
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

function emptyTableCellDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** Native grid table (not TipTap). `rowCount`/`columnCount` are body counts (excluding optional header row/column). */
export function createTableBlock(rowCount = 3, columnCount = 3, hasHeaderRow = true): StoryTableBlock {
  const bodyRows = Math.max(1, rowCount);
  const bodyCols = Math.max(1, columnCount);
  const totalRows = bodyRows + (hasHeaderRow ? 1 : 0);
  const cells = Array.from({ length: totalRows }, () => Array.from({ length: bodyCols }, emptyTableCellDoc));
  return {
    id: newStoryId(),
    type: "table",
    hasHeaderRow,
    rowCount: bodyRows,
    columnCount: bodyCols,
    cells,
  };
}

export { emptyTableCellDoc };

/** Primary text + supporting panel (media/embed/table, wrap layout). */
export function createSplitContentBlock(): StorySplitContentBlock {
  const text = createRichTextBlock();
  return {
    id: newStoryId(),
    type: "splitContent",
    text: { ...text, preset: "paragraph" },
    supporting: { id: newStoryId(), blocks: [] },
    supportingSide: "right",
    supportingWidthPct: 33,
    supportingGapRem: 1.5,
  };
}

export function createContainerBlock(): StoryContainerBlock {
  return {
    id: newStoryId(),
    type: "container",
    props: {
      preset: "default",
      background: "none",
      padding: "md",
      border: "none",
      width: "normal",
      align: "center",
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
        dateAnnotations: nb.dateAnnotations ? [...nb.dateAnnotations] : undefined,
        placeAnnotations: nb.placeAnnotations ? [...nb.placeAnnotations] : undefined,
        preset: nb.preset,
        headingLevel: nb.headingLevel,
        listVariant: nb.listVariant,
        quoteAttribution: nb.quoteAttribution,
        quoteStyle: nb.quoteStyle,
        verseSpacing: nb.verseSpacing,
        verseTitle: nb.verseTitle,
        verseContent: nb.verseContent,
        verseTitleAlign: nb.verseTitleAlign,
        verseContentAlign: nb.verseContentAlign,
        verseLineLayout: nb.verseLineLayout,
        headingPresetLocked: nb.headingPresetLocked,
        listPresetLocked: nb.listPresetLocked,
      };
    case "media":
      return { ...nb, id: newStoryId() };
    case "embed":
      return {
        ...nb,
        id: newStoryId(),
        subject: nb.subject ? { ...nb.subject } : undefined,
        presentation: nb.presentation ? { ...nb.presentation } : undefined,
        data: nb.data ? structuredClone(nb.data) : undefined,
      } as StoryColumnNestedBlock;
    case "columns":
      return {
        ...nb,
        id: newStoryId(),
        columnWidthPercents: nb.columnWidthPercents,
        columnGapRem: nb.columnGapRem,
        columns: [cloneColumnSlot(nb.columns[0]), cloneColumnSlot(nb.columns[1])],
      };
    case "container": {
      const props = { ...nb.props };
      delete (props as Record<string, unknown>).containerPreset;
      return {
        ...nb,
        id: newStoryId(),
        props,
        children: nb.children.map(cloneStoryBlock),
        containerPresetLocked: nb.containerPresetLocked,
      };
    }
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
        dateAnnotations: nb.dateAnnotations ? [...nb.dateAnnotations] : undefined,
        placeAnnotations: nb.placeAnnotations ? [...nb.placeAnnotations] : undefined,
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
        dateAnnotations: block.dateAnnotations ? [...block.dateAnnotations] : undefined,
        placeAnnotations: block.placeAnnotations ? [...block.placeAnnotations] : undefined,
        preset: block.preset,
        headingLevel: block.headingLevel,
        listVariant: block.listVariant,
        quoteAttribution: block.quoteAttribution,
        quoteStyle: block.quoteStyle,
        verseSpacing: block.verseSpacing,
        verseTitle: block.verseTitle,
        verseContent: block.verseContent,
        verseTitleAlign: block.verseTitleAlign,
        verseContentAlign: block.verseContentAlign,
        verseLineLayout: block.verseLineLayout,
        headingPresetLocked: block.headingPresetLocked,
        listPresetLocked: block.listPresetLocked,
      };
    case "media":
      return { ...block, id: newStoryId() };
    case "embed":
      return {
        ...block,
        id: newStoryId(),
        subject: block.subject ? { ...block.subject } : undefined,
        presentation: block.presentation ? { ...block.presentation } : undefined,
        data: block.data ? structuredClone(block.data) : undefined,
      } as StoryBlock;
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
    case "container": {
      const props = { ...block.props };
      delete (props as Record<string, unknown>).containerPreset;
      return {
        ...block,
        id: newStoryId(),
        props,
        children: block.children.map(cloneStoryBlock),
        design: block.design ? { ...block.design } : undefined,
        containerPresetLocked: block.containerPresetLocked,
      };
    }
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
