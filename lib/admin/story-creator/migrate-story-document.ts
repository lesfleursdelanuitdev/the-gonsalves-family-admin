import { EMPTY_STORY_DOC, storyDocJsonEquals } from "@/components/admin/story-creator/story-tiptap-doc";
import type {
  StoryBlock,
  StoryColumnNestedBlock,
  StoryColumnSlot,
  StoryColumnsBlock,
  StoryContainerBlockProps,
  StoryContainerWidth,
  StoryAuthorCredit,
  StoryAuthorPrefixMode,
  StoryDocument,
  StoryDocumentKind,
  StoryLinkedPlace,
  StoryEmbedBlock,
  StoryGeneralEmbedKind,
  StoryDividerBlock,
  StoryDividerVariant,
  StoryMediaBlock,
  StoryRichTextBlock,
  StorySection,
  StorySplitSupportBlock,
  StoryTableBlock,
} from "@/lib/admin/story-creator/story-types";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { newStoryId } from "@/lib/admin/story-creator/story-types";
import { parseStoryAuthorsFromMetaArray } from "@/lib/admin/story-creator/story-author-display";
import { MAX_STORY_COLUMNS_NEST_DEPTH } from "@/lib/admin/story-creator/story-columns-depth";
import { withColumnSlotDefaults } from "@/lib/admin/story-creator/story-columns-layout";
import { ensureMediaEmbedRowLayoutMigrated } from "@/lib/admin/story-creator/story-media-embed-layout-sync";
import { normalizeRootSections, normalizeStorySection } from "@/lib/admin/story-creator/story-section-tree";
import { createDefaultSectionBlocks } from "@/lib/admin/story-creator/story-block-factory";
import { legacyCoverImageRef } from "@/lib/admin/story-creator/story-images-resolve";
import { normalizeStorySlugInput } from "@/lib/admin/story-creator/story-slug";

const GENERAL_EMBED_KINDS: readonly StoryGeneralEmbedKind[] = [
  "document",
  "timeline",
  "map",
  "tree",
  "graph",
  "gallery",
  "personSpotlight",
  "familyGroup",
  "event",
];

/** Legacy persisted block shape (removed from `StoryBlock`; still on disk until migration runs). */
type LegacyStoryTableJson = {
  id: string;
  type: "table";
  hasHeadingRow?: boolean;
  headers?: unknown;
  rows?: unknown;
};

/** Legacy persisted `embedKind` values (incl. before media was split to `type: "media"`). */
function legacyEmbedKindToMediaOrGeneral(raw: string): "media" | StoryGeneralEmbedKind {
  if (raw === "image" || raw === "video" || raw === "audio" || raw === "media") return "media";
  if (GENERAL_EMBED_KINDS.includes(raw as StoryGeneralEmbedKind)) return raw as StoryGeneralEmbedKind;
  return "document";
}

/** Old on-disk shape: `type: "embed"` with optional `embedKind` + `mediaId`. */
type LegacyEmbedJson = {
  id: string;
  type: "embed";
  embedKind?: string;
  label?: string;
  sublabel?: string;
  mediaId?: string;
  caption?: string;
  titlePlacement?: StoryMediaBlock["titlePlacement"];
  captionPlacement?: StoryMediaBlock["captionPlacement"];
  layoutAlign?: StoryEmbedBlock["layoutAlign"];
  widthPreset?: StoryEmbedBlock["widthPreset"];
  heightPreset?: StoryEmbedBlock["heightPreset"];
  fullWidth?: boolean;
  textWrap?: boolean;
  linkMode?: StoryEmbedBlock["linkMode"];
};

function legacyEmbedToBlock(b: LegacyEmbedJson): StoryMediaBlock | StoryEmbedBlock {
  const slot = legacyEmbedKindToMediaOrGeneral(String(b.embedKind ?? "document"));
  if (slot === "media") {
    const out: StoryMediaBlock = {
      id: b.id,
      type: "media",
      mediaId: b.mediaId,
      label: typeof b.label === "string" ? b.label : "",
      caption: b.caption,
      titlePlacement: b.titlePlacement,
      captionPlacement: b.captionPlacement,
      layoutAlign: b.layoutAlign,
      widthPreset: b.widthPreset,
      heightPreset: b.heightPreset,
      fullWidth: b.fullWidth,
      textWrap: b.textWrap,
      linkMode: b.linkMode,
    };
    return out;
  }
  return {
    id: b.id,
    type: "embed",
    embedKind: slot,
    label: typeof b.label === "string" ? b.label : "Embed",
    sublabel: b.sublabel,
    caption: b.caption,
    titlePlacement: b.titlePlacement,
    captionPlacement: b.captionPlacement,
    layoutAlign: b.layoutAlign,
    widthPreset: b.widthPreset,
    heightPreset: b.heightPreset,
    fullWidth: b.fullWidth,
    textWrap: b.textWrap,
    linkMode: b.linkMode,
  };
}

function normalizeContainerWidth(raw: StoryContainerBlockProps["width"] | undefined): StoryContainerWidth {
  if (raw === "narrow" || raw === "normal" || raw === "wide" || raw === "full") return raw;
  if (raw === "constrained") return "normal";
  return "normal";
}

function defaultContainerProps(raw: StoryContainerBlockProps | undefined): StoryContainerBlockProps {
  const presetVal = raw?.preset ?? raw?.containerPreset;
  return {
    background: raw?.background ?? "none",
    padding: raw?.padding ?? "md",
    border: raw?.border ?? "none",
    width: normalizeContainerWidth(raw?.width),
    align: raw?.align ?? "center",
    label: raw?.label,
    customBackground: raw?.customBackground,
    preset: presetVal,
    containerPreset: presetVal,
    rowLayout: raw?.rowLayout,
  };
}

const MIGRATE_DIVIDER_VARIANTS: readonly StoryDividerVariant[] = ["line", "spacer", "ornamental", "sectionBreak"];

function migrateRichTextBlock(b: StoryRichTextBlock): StoryRichTextBlock {
  const preset = b.preset ?? b.textPreset ?? "paragraph";
  return { ...b, preset, textPreset: b.textPreset ?? preset };
}

function migrateDividerBlock(b: StoryDividerBlock): StoryDividerBlock {
  const raw = b.preset ?? b.variant;
  const preset =
    raw && (MIGRATE_DIVIDER_VARIANTS as readonly string[]).includes(raw) ? (raw as StoryDividerVariant) : ("line" as const);
  return { ...b, preset, variant: preset };
}

function migrateNested(nb: StoryColumnNestedBlock): StoryColumnNestedBlock {
  if (nb.type === "richText") return migrateRichTextBlock(nb);
  if (nb.type === "media") return nb;
  if (nb.type === "table") {
    return migrateBlock(nb as StoryBlock) as StoryColumnNestedBlock;
  }
  if (nb.type === "splitContent") {
    return {
      ...nb,
      text: migrateNested(nb.text) as StoryRichTextBlock,
      supporting: {
        ...nb.supporting,
        blocks: nb.supporting.blocks.map(
          (sb) => migrateNested(sb as StoryColumnNestedBlock) as StorySplitSupportBlock,
        ),
      },
    };
  }
  if (nb.type === "container") {
    return {
      ...nb,
      props: defaultContainerProps(nb.props),
      children: nb.children.map(migrateAndClampBlock),
    };
  }
  if (nb.type === "columns") return migrateColumns(nb);
  if (nb.type === "embed") {
    return legacyEmbedToBlock(nb as unknown as LegacyEmbedJson) as StoryColumnNestedBlock;
  }
  return nb;
}

function tooDeepColumnPlaceholder(): StoryRichTextBlock {
  return {
    id: newStoryId(),
    type: "richText",
    preset: "paragraph",
    textPreset: "paragraph",
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Extra nested columns were removed to stay within the 2-level layout limit.",
            },
          ],
        },
      ],
    },
  };
}

function clampNestedColumnBlocks(blocks: StoryColumnNestedBlock[], parentColumnsDepth: number): StoryColumnNestedBlock[] {
  return blocks.map((nb) => {
    if (nb.type === "container") {
      return {
        ...nb,
        children: nb.children.map(migrateAndClampBlock),
      };
    }
    if (nb.type !== "columns") return migrateNested(nb);
    const childDepth = parentColumnsDepth + 1;
    if (childDepth > MAX_STORY_COLUMNS_NEST_DEPTH) {
      return tooDeepColumnPlaceholder();
    }
    const migrated = migrateColumns(nb);
    return {
      ...migrated,
      columns: [
        {
          ...migrated.columns[0],
          blocks: clampNestedColumnBlocks(migrated.columns[0].blocks, childDepth),
        },
        {
          ...migrated.columns[1],
          blocks: clampNestedColumnBlocks(migrated.columns[1].blocks, childDepth),
        },
      ],
    };
  });
}

function clampColumnsTree(block: StoryColumnsBlock): StoryColumnsBlock {
  return {
    ...block,
    columns: [
      {
        ...block.columns[0],
        blocks: clampNestedColumnBlocks(block.columns[0].blocks, 1),
      },
      {
        ...block.columns[1],
        blocks: clampNestedColumnBlocks(block.columns[1].blocks, 1),
      },
    ],
  };
}

function migrateAndClampBlock(b: StoryBlock): StoryBlock {
  const m = migrateBlock(b);
  if (m.type === "columns") return clampColumnsTree(m);
  return m;
}

function isEmptyRichDoc(doc: unknown): boolean {
  return storyDocJsonEquals(doc, EMPTY_STORY_DOC);
}

function normalizeColumnSlot(raw: unknown): StoryColumnSlot {
  const r = raw as Record<string, unknown> & {
    id?: unknown;
    blocks?: unknown;
    block?: unknown;
    stackJustify?: unknown;
    stackGapRem?: unknown;
  };
  const id = typeof r.id === "string" ? r.id : newStoryId();
  let blocks: StoryColumnNestedBlock[];
  if (Array.isArray(r.blocks)) {
    blocks = (r.blocks as StoryColumnNestedBlock[]).map((x) => migrateNested(x));
  } else if (r.block && typeof r.block === "object") {
    blocks = [migrateNested(r.block as StoryColumnNestedBlock)];
  } else {
    blocks = [];
  }
  const slot: StoryColumnSlot = {
    id,
    blocks,
    stackJustify: r.stackJustify as StoryColumnSlot["stackJustify"],
    stackGapRem: typeof r.stackGapRem === "number" ? r.stackGapRem : undefined,
  };
  return withColumnSlotDefaults(slot);
}

function withColumnLayoutDefaults(block: StoryColumnsBlock): StoryColumnsBlock {
  const p = block.columnWidthPercents;
  const g = block.columnGapRem;
  const okP =
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] > 0 &&
    p[1] > 0;
  const okG = typeof g === "number" && Number.isFinite(g) && g >= 0;
  return {
    ...block,
    columnWidthPercents: okP ? (p as [number, number]) : [50, 50],
    columnGapRem: okG ? g : 1,
    columns: [
      withColumnSlotDefaults(block.columns[0]),
      withColumnSlotDefaults(block.columns[1]),
    ],
  };
}

function migrateColumns(b: StoryColumnsBlock): StoryColumnsBlock {
  const raw = b as unknown as Record<string, unknown>;
  if (Array.isArray(raw.columns) && raw.columns.length === 2) {
    const c0 = raw.columns[0];
    const c1 = raw.columns[1];
    return withColumnLayoutDefaults({
      ...b,
      columns: [normalizeColumnSlot(c0), normalizeColumnSlot(c1)],
    });
  }
  const legacy = raw as {
    id: string;
    leftDoc?: unknown;
    rightDoc?: unknown;
  };
  const leftBlock: StoryColumnNestedBlock | null =
    legacy.leftDoc && !isEmptyRichDoc(legacy.leftDoc)
      ? { id: newStoryId(), type: "richText", doc: legacy.leftDoc as StoryRichTextBlock["doc"] }
      : null;
  const rightBlock: StoryColumnNestedBlock | null =
    legacy.rightDoc && !isEmptyRichDoc(legacy.rightDoc)
      ? { id: newStoryId(), type: "richText", doc: legacy.rightDoc as StoryRichTextBlock["doc"] }
      : null;
  return withColumnLayoutDefaults({
    id: legacy.id,
    type: "columns",
    columnWidthPercents: [50, 50],
    columnGapRem: 1,
    columns: [
      normalizeColumnSlot({ id: newStoryId(), blocks: leftBlock ? [leftBlock] : [] }),
      normalizeColumnSlot({ id: newStoryId(), blocks: rightBlock ? [rightBlock] : [] }),
    ],
  });
}

function coerceStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((v) => (typeof v === "string" ? v : String(v ?? "")));
}

function coerceRows(x: unknown): string[][] {
  if (!Array.isArray(x)) return [];
  return x.map((row) => coerceStringArray(row));
}

function padCells(cells: string[], nCols: number): string[] {
  const out = [...cells];
  while (out.length < nCols) out.push("");
  return out.slice(0, nCols);
}

/** Convert legacy standalone `table` JSON → native {@link StoryTableBlock} (same id). */
function legacyTableToNativeTable(b: LegacyStoryTableJson): StoryTableBlock {
  const headers = coerceStringArray(b.headers);
  const rows = coerceRows(b.rows);
  const hasHeadingRow = b.hasHeadingRow !== false;
  const nCols = Math.max(headers.length, rows.reduce((m, r) => Math.max(m, r.length), 0), 1);
  const cells: string[][] = [];
  if (hasHeadingRow && headers.some((h) => String(h).trim().length > 0)) {
    cells.push(padCells(headers, nCols));
    for (const r of rows) cells.push(padCells(r, nCols));
  } else if (rows.length > 0) {
    for (const r of rows) cells.push(padCells(r, nCols));
  } else {
    cells.push(Array.from({ length: nCols }, () => ""));
  }
  return {
    id: b.id,
    type: "table",
    hasHeaderRow: hasHeadingRow && headers.length > 0,
    columnCount: nCols,
    rowCount: cells.length,
    cells,
  };
}

function migrateNativeTableOnDisk(b: StoryTableBlock): StoryTableBlock {
  const cols = Math.max(1, b.columnCount || 1);
  const rows = Array.isArray(b.cells) ? b.cells.map((r) => coerceStringArray(r as unknown)) : [];
  const padded = rows.map((r) => padCells(r, cols));
  while (padded.length < Math.max(1, b.rowCount || 1)) {
    padded.push(Array.from({ length: cols }, () => ""));
  }
  const cells = padded.map((r) => padCells(r, cols));
  return {
    ...b,
    columnCount: cols,
    rowCount: cells.length,
    cells,
  };
}

function migrateBlock(b: StoryBlock): StoryBlock {
  const t = (b as unknown as { type?: string }).type;
  if (t === "table") {
    const raw = b as unknown as Record<string, unknown>;
    if (Array.isArray(raw.cells) && typeof raw.columnCount === "number") {
      return migrateNativeTableOnDisk(b as StoryTableBlock);
    }
    return legacyTableToNativeTable(b as unknown as LegacyStoryTableJson) as StoryBlock;
  }
  if (b.type === "columns") return migrateColumns(b);
  if (b.type === "container") {
    return {
      ...b,
      props: defaultContainerProps(b.props),
      children: b.children.map(migrateAndClampBlock),
    };
  }
  if (b.type === "media") return ensureMediaEmbedRowLayoutMigrated(b) as StoryBlock;
  if (b.type === "embed") {
    const next = legacyEmbedToBlock(b as unknown as LegacyEmbedJson) as StoryBlock;
    return next.type === "embed" ? (ensureMediaEmbedRowLayoutMigrated(next) as StoryBlock) : next;
  }
  if (b.type === "richText") return migrateRichTextBlock(b);
  if (b.type === "divider") return migrateDividerBlock(b);
  return b;
}

const STORY_KINDS = new Set<StoryDocumentKind>(["story", "article", "post"]);

function normalizeStoryKind(raw: unknown): StoryDocumentKind {
  return typeof raw === "string" && STORY_KINDS.has(raw as StoryDocumentKind) ? (raw as StoryDocumentKind) : "story";
}

const STORY_LINK_KINDS = new Set<SelectedNoteLink["kind"]>(["individual", "family", "event"]);

function normalizeStoryLinkedRecords(raw: unknown): SelectedNoteLink[] {
  if (!Array.isArray(raw)) return [];
  const out: SelectedNoteLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind;
    const id = o.id;
    const label = o.label;
    if (typeof kind !== "string" || !STORY_LINK_KINDS.has(kind as SelectedNoteLink["kind"])) continue;
    if (typeof id !== "string" || !id.trim()) continue;
    if (typeof label !== "string") continue;
    out.push({ kind: kind as SelectedNoteLink["kind"], id: id.trim(), label });
  }
  return out;
}

function optionalTrimmedString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Normalize persisted `placeLinks`; dedupe by `id`; safe for older drafts without the field. */
function normalizeStoryPlaceLinks(raw: unknown): StoryLinkedPlace[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryLinkedPlace[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) continue;
    const id = o.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const labelRaw = o.label;
    const label = typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim() : id;
    const row: StoryLinkedPlace = { id, label };
    const name = optionalTrimmedString(o.name);
    if (name !== undefined) row.name = name === null ? null : name;
    const original = optionalTrimmedString(o.original);
    if (original !== undefined) row.original = original === null ? null : original;
    const county = optionalTrimmedString(o.county);
    if (county !== undefined) row.county = county === null ? null : county;
    const state = optionalTrimmedString(o.state);
    if (state !== undefined) row.state = state === null ? null : state;
    const country = optionalTrimmedString(o.country);
    if (country !== undefined) row.country = country === null ? null : country;
    out.push(row);
  }
  return out;
}

type LegacyStoryDisk = StoryDocument & {
  albumIds?: string[];
  linkedGedcomNoteIds?: string[];
};

/** Pre–section-tree disk shape: chapters each holding flat sections. */
type LegacyChapterJson = {
  id: string;
  title: string;
  collapsed: boolean;
  sections: Array<{ id: string; title: string; blocks: StoryBlock[] }>;
};

function migrateStorySectionTree(nodes: StorySection[]): StorySection[] {
  return nodes.map((node) =>
    normalizeStorySection({
      ...node,
      blocks: (node.blocks ?? []).map(migrateAndClampBlock),
      children: node.children?.length ? migrateStorySectionTree(node.children) : undefined,
    }),
  );
}

function legacyChaptersToSections(chapters: LegacyChapterJson[]): StorySection[] {
  return chapters.map((ch) =>
    normalizeStorySection({
      id: ch.id,
      title: ch.title,
      collapsed: ch.collapsed,
      blocks: [],
      children: (Array.isArray(ch.sections) ? ch.sections : []).map((sec) =>
        normalizeStorySection({
          id: sec.id,
          title: sec.title,
          blocks: Array.isArray(sec.blocks) ? sec.blocks.map(migrateAndClampBlock) : [],
        }),
      ),
    }),
  );
}

/** Normalize persisted story JSON to the latest block shapes (columns slots, media vs embed, legacy tables → rich text). */
export function migrateStoryDocument(doc: StoryDocument): StoryDocument {
  const raw = doc as LegacyStoryDisk;
  const { albumIds: legacyAlbumIds, linkedGedcomNoteIds: _legacyNotes } = raw;

  let linkedAlbums = doc.linkedAlbums;
  if ((!linkedAlbums || linkedAlbums.length === 0) && legacyAlbumIds?.length) {
    linkedAlbums = legacyAlbumIds.map((id) => ({
      id,
      name: id.length > 14 ? `${id.slice(0, 8)}…` : id,
    }));
  }

  const diskAuthor = (doc as Record<string, unknown>)["author"];
  const author = typeof diskAuthor === "string" && diskAuthor.trim() ? diskAuthor.trim() : undefined;

  const PREFIX_MODES = new Set<string>(["by", "author_label", "custom", "none"]);
  const rawPrefixMode = (doc as Record<string, unknown>)["authorPrefixMode"];
  const authorPrefixMode: StoryAuthorPrefixMode | undefined =
    typeof rawPrefixMode === "string" && PREFIX_MODES.has(rawPrefixMode) ? (rawPrefixMode as StoryAuthorPrefixMode) : undefined;
  const rawPrefixCustom = (doc as Record<string, unknown>)["authorPrefixCustom"];
  const authorPrefixCustom = typeof rawPrefixCustom === "string" ? rawPrefixCustom : undefined;

  const rawRec = doc as unknown as Record<string, unknown>;
  const fromAuthorsJson = parseStoryAuthorsFromMetaArray(rawRec.authors);
  let authors: StoryAuthorCredit[];
  if (fromAuthorsJson.length > 0) {
    authors = fromAuthorsJson;
  } else if (author) {
    authors = [{ id: newStoryId(), name: author, authorPrefixMode, authorPrefixCustom }];
  } else {
    authors = [];
  }

  let sections: StorySection[];
  if (Array.isArray(rawRec.sections)) {
    sections = migrateStorySectionTree(normalizeRootSections(rawRec.sections as StorySection[]));
  } else if (Array.isArray(rawRec.chapters)) {
    sections = legacyChaptersToSections(rawRec.chapters as LegacyChapterJson[]);
  } else {
    sections = [
      normalizeStorySection({
        id: newStoryId(),
        title: "Section 1",
        blocks: createDefaultSectionBlocks(),
      }),
    ];
  }

  if (sections.length === 0) {
    sections = [
      normalizeStorySection({
        id: newStoryId(),
        title: "Section 1",
        collapsed: false,
        blocks: createDefaultSectionBlocks(),
      }),
    ];
  }

  const merged = { ...doc, sections } as Record<string, unknown>;
  delete merged.chapters;

  const next: StoryDocument = {
    ...(merged as StoryDocument),
    authors,
    author: undefined,
    authorPrefixMode: undefined,
    authorPrefixCustom: undefined,
    kind: normalizeStoryKind(doc.kind),
    linkedAlbums: linkedAlbums ?? [],
    linkedRecords: normalizeStoryLinkedRecords(doc.linkedRecords),
    placeLinks: normalizeStoryPlaceLinks((doc as Record<string, unknown>).placeLinks),
    sections,
  };
  const coverImage = next.coverImage ?? legacyCoverImageRef(next) ?? undefined;
  let out: StoryDocument = { ...next, coverImage };
  const slugNorm = normalizeStorySlugInput(out.slug ?? "");
  if (slugNorm.length > 0 && !out.slugManuallyEdited) {
    out = { ...out, slug: slugNorm, slugManuallyEdited: true };
  }
  return out;
}
