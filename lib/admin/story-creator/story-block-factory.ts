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
} from "@/lib/admin/story-creator/story-types";
import { newStoryId } from "@/lib/admin/story-creator/story-types";

export function createRichTextBlock(): StoryRichTextBlock {
  return { id: newStoryId(), type: "richText", doc: EMPTY_STORY_DOC };
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

export function createDividerBlock(): StoryDividerBlock {
  return { id: newStoryId(), type: "divider" };
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
  }
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
      };
    case "media":
      return { ...block, id: newStoryId() };
    case "embed":
      return { ...block, id: newStoryId() };
    case "divider":
      return {
        id: newStoryId(),
        type: "divider",
        design: block.design ? { ...block.design } : undefined,
      };
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
  }
}
