import type { JSONContent } from "@tiptap/core";
import type {
  StoryBlock,
  StoryColumnNestedBlock,
  StoryGeneralEmbedKind,
  StoryRichTextTextPreset,
  StorySplitSupportBlock,
} from "@/lib/admin/story-creator/story-types";
import { getStoryDividerPreset, getStoryRichTextPreset } from "@/lib/admin/story-creator/story-types";
import {
  createColumnsBlock,
  createContainerBlock,
  createDividerBlock,
  createEmbedBlock,
  createMediaBlock,
  createRichTextBlock,
  createSplitContentBlock,
  createTableBlock,
} from "@/lib/admin/story-creator/story-block-factory";
import { EMPTY_STORY_DOC, emptyListStarterDoc } from "@/components/admin/story-creator/story-tiptap-doc";

/** Central id for Add Block / placement UI — maps to stored blocks via {@link createStoryBlockFromPreset}. */
export type StoryAddBlockPresetId =
  | "text_paragraph"
  | "text_heading"
  | "text_list"
  | "text_verse"
  | "text_quote"
  | "data_table"
  | "media_default"
  | "media_wrapped"
  | "embed_gallery"
  | "embed_timeline"
  | "embed_map"
  | "embed_person"
  | "embed_family"
  | "embed_event"
  | "embed_tree"
  | "embed_document"
  | "layout_columns"
  | "layout_split"
  | "layout_container"
  | "layout_callout"
  | "layout_hero"
  | "layout_divider"
  | "layout_divider_ornamental"
  | "layout_section_break"
  | "layout_spacer";

export type StoryAddBlockCategoryId = "text" | "data" | "media" | "embeds" | "layout";

export type StoryAddBlockPresetItem = {
  id: StoryAddBlockPresetId;
  label: string;
  description?: string;
};

export type StoryAddBlockPresetGroup = {
  categoryId: StoryAddBlockCategoryId;
  title: string;
  items: StoryAddBlockPresetItem[];
};

export const STORY_ADD_BLOCK_PRESET_GROUPS: StoryAddBlockPresetGroup[] = [
  {
    categoryId: "text",
    title: "Text",
    items: [
      { id: "text_paragraph", label: "Paragraph", description: "Rich text body" },
      { id: "text_heading", label: "Heading", description: "Section-style heading" },
      { id: "text_list", label: "List", description: "Bulleted or numbered list" },
      { id: "text_verse", label: "Verse", description: "Line breaks preserved" },
      { id: "text_quote", label: "Quote / testimonial", description: "Quoted passage" },
    ],
  },
  {
    categoryId: "data",
    title: "Data / structured",
    items: [{ id: "data_table", label: "Table", description: "Custom grid table (not TipTap)" }],
  },
  {
    categoryId: "media",
    title: "Media",
    items: [
      { id: "media_default", label: "Media", description: "Image, video, or audio" },
      {
        id: "media_wrapped",
        label: "Text + media (wrap)",
        description: "Split content: write beside a media slot (wrap layout when enabled)",
      },
    ],
  },
  {
    categoryId: "embeds",
    title: "Embeds",
    items: [
      { id: "embed_gallery", label: "Gallery" },
      { id: "embed_timeline", label: "Timeline" },
      { id: "embed_map", label: "Map / location" },
      { id: "embed_person", label: "Person spotlight" },
      { id: "embed_family", label: "Family group" },
      { id: "embed_event", label: "Event" },
      { id: "embed_tree", label: "Tree" },
      { id: "embed_document", label: "Document / file" },
    ],
  },
  {
    categoryId: "layout",
    title: "Layout",
    items: [
      { id: "layout_columns", label: "Columns", description: "Two independent stacks" },
      { id: "layout_split", label: "Split content", description: "Text + supporting media/embed" },
      {
        id: "layout_container",
        label: "Container / card",
        description: "Group blocks inside a subtle card frame with padding",
      },
      {
        id: "layout_callout",
        label: "Callout",
        description: "Soft background panel for tips, asides, or short highlights",
      },
      {
        id: "layout_hero",
        label: "Hero",
        description: "Full-width band for titles, imagery, or featured content up front",
      },
      { id: "layout_divider", label: "Divider", description: "Simple horizontal rule" },
      { id: "layout_divider_ornamental", label: "Ornamental divider", description: "Decorative rule" },
      { id: "layout_section_break", label: "Section break", description: "Strong separation between sections" },
      { id: "layout_spacer", label: "Spacer", description: "Whitespace only when published" },
    ],
  },
];

/** Dock / mobile bottom sheet: same grouped layout as full-screen add, curated presets (Text = paragraph + heading + list). */
export const STORY_ADD_BLOCK_DOCK_PRESET_GROUPS: StoryAddBlockPresetGroup[] = (() => {
  const byCat = (id: StoryAddBlockCategoryId) => STORY_ADD_BLOCK_PRESET_GROUPS.find((g) => g.categoryId === id);
  const textIds: StoryAddBlockPresetId[] = ["text_paragraph", "text_heading", "text_list"];
  const text = byCat("text")?.items.filter((i) => textIds.includes(i.id)) ?? [];
  const media = byCat("media")?.items.filter((i) => i.id === "media_default") ?? [];
  const embeds = byCat("embeds")?.items.filter((i) => i.id === "embed_document") ?? [];
  const layoutIds: StoryAddBlockPresetId[] = [
    "layout_columns",
    "layout_container",
    "layout_callout",
    "layout_hero",
    "layout_divider",
  ];
  const layout = byCat("layout")?.items.filter((i) => layoutIds.includes(i.id)) ?? [];
  return [
    { categoryId: "text", title: "Text", items: text },
    { categoryId: "media", title: "Media", items: media },
    { categoryId: "embeds", title: "Embeds", items: embeds },
    { categoryId: "layout", title: "Layout", items: layout },
  ];
})();

function richDocHeading(level: 1 | 2 | 3 | 4 | 5 | 6): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text: "" }],
      },
    ],
  };
}

function richDocVerse(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "" }],
      },
    ],
  };
}

function richDocQuote(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
      },
    ],
  };
}

function withRichPreset(
  doc: JSONContent,
  preset: StoryRichTextTextPreset,
  opts?: { headingLevel?: 1 | 2 | 3 | 4 | 5 | 6; listVariant?: "bullet" | "ordered" },
): ReturnType<typeof createRichTextBlock> {
  const base = createRichTextBlock();
  return {
    ...base,
    doc,
    preset,
    textPreset: preset,
    headingLevel: opts?.headingLevel,
    listVariant: opts?.listVariant,
  };
}

/** Whether this preset can be inserted into a columns cell (no dividers). */
export function storyAddBlockPresetAllowedInColumnNested(id: StoryAddBlockPresetId): boolean {
  if (
    id === "layout_divider" ||
    id === "layout_divider_ornamental" ||
    id === "layout_section_break" ||
    id === "layout_spacer"
  ) {
    return false;
  }
  return true;
}

export function createStoryBlockFromPreset(id: StoryAddBlockPresetId): StoryBlock {
  switch (id) {
    case "text_paragraph":
      return withRichPreset(EMPTY_STORY_DOC as JSONContent, "paragraph");
    case "text_heading":
      return withRichPreset(richDocHeading(2), "heading", { headingLevel: 2 });
    case "text_list":
      return withRichPreset(emptyListStarterDoc("bullet"), "list", { listVariant: "bullet" });
    case "text_verse":
      return { ...withRichPreset(richDocVerse(), "verse"), verseSpacing: "relaxed" };
    case "text_quote":
      return {
        ...withRichPreset(richDocQuote(), "quote"),
        quoteStyle: "simple",
      };
    case "data_table":
      return createTableBlock(3, 3, true);
    case "media_default":
      return createMediaBlock();
    case "media_wrapped": {
      const split = createSplitContentBlock();
      const media = createMediaBlock();
      return {
        ...split,
        supportingSide: "right",
        supporting: {
          ...split.supporting,
          blocks: [{ ...media, widthPreset: "medium", layoutAlign: "center" }],
        },
      };
    }
    case "embed_gallery":
      return labelEmbed("gallery", "Gallery");
    case "embed_timeline":
      return labelEmbed("timeline", "Timeline");
    case "embed_map":
      return labelEmbed("map", "Map");
    case "embed_person":
      return labelEmbed("personSpotlight", "Person spotlight");
    case "embed_family":
      return labelEmbed("familyGroup", "Family group");
    case "embed_event":
      return labelEmbed("event", "Event");
    case "embed_tree":
      return labelEmbed("tree", "Tree");
    case "embed_document":
      return labelEmbed("document", "Document");
    case "layout_columns":
      return createColumnsBlock();
    case "layout_split":
      return createSplitContentBlock();
    case "layout_container": {
      const c = createContainerBlock();
      return {
        ...c,
        containerPresetLocked: true,
        props: {
          ...c.props,
          label: "Card",
          border: "subtle",
          padding: "md",
          preset: "card",
        },
      };
    }
    case "layout_callout": {
      const c = createContainerBlock();
      return {
        ...c,
        containerPresetLocked: true,
        props: {
          ...c.props,
          label: "Callout",
          background: "subtle",
          border: "subtle",
          padding: "md",
          preset: "callout",
        },
      };
    }
    case "layout_hero": {
      const c = createContainerBlock();
      return {
        ...c,
        containerPresetLocked: true,
        props: {
          ...c.props,
          label: "Hero",
          background: "subtle",
          padding: "lg",
          width: "full",
          preset: "hero",
        },
      };
    }
    case "layout_divider":
      return createDividerBlock({ variant: "line" });
    case "layout_divider_ornamental":
      return { ...createDividerBlock({ variant: "ornamental" }), ornamentalStyle: "diamonds" };
    case "layout_section_break":
      return createDividerBlock({ variant: "sectionBreak" });
    case "layout_spacer": {
      const d = createDividerBlock({ variant: "spacer" });
      return { ...d, spacerRem: 2 };
    }
    default:
      return withRichPreset(EMPTY_STORY_DOC as JSONContent, "paragraph");
  }
}

function labelEmbed(kind: StoryGeneralEmbedKind, label: string) {
  const e = createEmbedBlock(kind);
  return { ...e, label };
}

export function createColumnNestedBlockFromPreset(id: StoryAddBlockPresetId): StoryColumnNestedBlock {
  if (!storyAddBlockPresetAllowedInColumnNested(id)) {
    return createRichTextBlock();
  }
  return createStoryBlockFromPreset(id) as StoryColumnNestedBlock;
}

/** Presets allowed in a split block’s supporting rail (not primary text flow). */
export const STORY_SPLIT_SUPPORT_ADD_PRESET_IDS: readonly StoryAddBlockPresetId[] = [
  "media_default",
  "embed_gallery",
  "embed_timeline",
  "embed_map",
  "embed_person",
  "embed_family",
  "embed_event",
  "embed_tree",
  "embed_document",
  "data_table",
  "layout_columns",
  "layout_container",
  "layout_callout",
  "layout_hero",
] as const;

export function createSplitSupportBlockFromPreset(id: StoryAddBlockPresetId): StorySplitSupportBlock | null {
  const b = createStoryBlockFromPreset(id);
  switch (b.type) {
    case "media":
    case "embed":
    case "columns":
    case "container":
    case "table":
      return b;
    default:
      return null;
  }
}

/** Short label for block chrome / outline (single source of truth vs scattered strings). */
export function storyBlockDisplayLabel(block: StoryBlock): string {
  switch (block.type) {
    case "richText": {
      const p = getStoryRichTextPreset(block);
      if (p === "heading") return "Heading";
      if (p === "list") return "List";
      if (p === "verse") return "Verse";
      if (p === "quote") return "Quote";
      return "Text";
    }
    case "media":
      return "Media";
    case "embed":
      return block.label?.trim() || `Embed (${block.embedKind})`;
    case "columns":
      return "Columns";
    case "divider": {
      const pr = getStoryDividerPreset(block);
      if (pr === "spacer") return "Spacer";
      if (pr === "ornamental") return "Ornamental divider";
      if (pr === "sectionBreak") return "Section break";
      return "Divider";
    }
    case "container":
      return block.props.label?.trim() || "Container";
    case "table":
      return "Table";
    case "splitContent":
      return "Split content";
    default: {
      const _x: never = block;
      return _x;
    }
  }
}
