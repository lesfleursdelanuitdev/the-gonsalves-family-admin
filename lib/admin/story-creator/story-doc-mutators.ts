import type { JSONContent } from "@tiptap/core";
import type {
  StoryBlock,
  StoryBlockDateAnnotation,
  StoryBlockDesign,
  StoryBlockRowLayout,
  StoryColumnNestedBlock,
  StoryColumnSlot,
  StoryColumnsBlock,
  StoryContainerBlock,
  StoryContainerBlockProps,
  StoryDividerBlock,
  StoryEmbedBlock,
  StoryMediaBlock,
  StoryRichTextBlock,
  StorySection,
  StorySplitContentBlock,
  StorySplitSupportBlock,
} from "@/lib/admin/story-creator/story-types";
import { getStoryRichTextPreset } from "@/lib/admin/story-creator/story-types";
import {
  applyHeadingLevelToRichTextDoc,
  clampStoryRichTextHeadingLevel,
  inferFirstHeadingLevel,
  swapListVariantInDoc,
  transformRichTextDocToList,
  unwrapListItemsToParagraphDoc,
} from "@/components/admin/story-creator/story-tiptap-doc";
import { mergeStoryBlockDesign } from "@/lib/admin/story-creator/story-block-design";
import { columnsBlockDepthInSection, MAX_STORY_COLUMNS_NEST_DEPTH } from "@/lib/admin/story-creator/story-columns-depth";
import { cloneStoryBlock } from "@/lib/admin/story-creator/story-block-factory";

function columnPair(c0: StoryColumnSlot, c1: StoryColumnSlot): [StoryColumnSlot, StoryColumnSlot] {
  return [c0, c1];
}

function mapSplitSupportingDeep(
  blocks: StorySplitSupportBlock[],
  mapper: (b: StoryBlock) => StoryBlock,
): StorySplitSupportBlock[] {
  return blocks.map((sb) => mapOneSplitSupporting(sb, mapper));
}

function mapOneSplitSupporting(sb: StorySplitSupportBlock, mapper: (b: StoryBlock) => StoryBlock): StorySplitSupportBlock {
  if (sb.type === "container") {
    const inner = mapStoryBlocksDeep(sb.children, mapper);
    return mapper({ ...sb, children: inner }) as StoryContainerBlock;
  }
  if (sb.type === "columns") {
    const inner: StoryColumnsBlock = {
      ...sb,
      columns: [
        { ...sb.columns[0], blocks: mapColumnNestedDeep(sb.columns[0].blocks, mapper) },
        { ...sb.columns[1], blocks: mapColumnNestedDeep(sb.columns[1].blocks, mapper) },
      ],
    };
    return mapper(inner) as StoryColumnsBlock;
  }
  return mapper(sb as StoryBlock) as StorySplitSupportBlock;
}

/** Bottom-up map over section blocks (containers + columns + split). */
function mapStoryBlocksDeep(blocks: StoryBlock[], mapper: (b: StoryBlock) => StoryBlock): StoryBlock[] {
  return blocks.map((b) => {
    let base: StoryBlock = b;
    if (b.type === "container") {
      base = { ...b, children: mapStoryBlocksDeep(b.children, mapper) };
    } else if (b.type === "columns") {
      base = {
        ...b,
        columns: [
          { ...b.columns[0], blocks: mapColumnNestedDeep(b.columns[0].blocks, mapper) },
          { ...b.columns[1], blocks: mapColumnNestedDeep(b.columns[1].blocks, mapper) },
        ],
      };
    } else if (b.type === "splitContent") {
      const mappedText = mapper(b.text as StoryBlock);
      const text: StoryRichTextBlock =
        mappedText.type === "richText" ? (mappedText as StoryRichTextBlock) : (b as StorySplitContentBlock).text;
      base = {
        ...(b as StorySplitContentBlock),
        text,
        supporting: {
          ...(b as StorySplitContentBlock).supporting,
          blocks: mapSplitSupportingDeep((b as StorySplitContentBlock).supporting.blocks, mapper),
        },
      };
    }
    return mapper(base);
  });
}

function withoutBlockDesign(b: StoryBlock): StoryBlock {
  const { design: _d, ...rest } = b as StoryBlock & { design?: StoryBlockDesign };
  return rest as StoryBlock;
}

function mapColumnNestedDeep(blocks: StoryColumnNestedBlock[], mapper: (b: StoryBlock) => StoryBlock): StoryColumnNestedBlock[] {
  return blocks.map((nb) => {
    let base: StoryBlock = nb as StoryBlock;
    if (nb.type === "container") {
      base = { ...nb, children: mapStoryBlocksDeep(nb.children, mapper) };
    } else if (nb.type === "columns") {
      base = {
        ...nb,
        columns: [
          { ...nb.columns[0], blocks: mapColumnNestedDeep(nb.columns[0].blocks, mapper) },
          { ...nb.columns[1], blocks: mapColumnNestedDeep(nb.columns[1].blocks, mapper) },
        ],
      } as StoryColumnsBlock;
    } else if (nb.type === "splitContent") {
      const mappedText = mapper(nb.text as StoryBlock);
      const text: StoryRichTextBlock =
        mappedText.type === "richText" ? (mappedText as StoryRichTextBlock) : nb.text;
      base = {
        ...nb,
        text,
        supporting: {
          ...nb.supporting,
          blocks: mapSplitSupportingDeep(nb.supporting.blocks, mapper),
        },
      };
    } else if (nb.type === "table") {
      base = nb;
    }
    return mapper(base) as StoryColumnNestedBlock;
  });
}

function patchColumnSlotDeep(
  slot: StoryColumnSlot,
  childId: string,
  fn: (nb: StoryColumnNestedBlock) => StoryColumnNestedBlock,
): StoryColumnSlot {
  const direct = slot.blocks.findIndex((x) => x.id === childId);
  if (direct >= 0) {
    const next = [...slot.blocks];
    next[direct] = fn(next[direct]!);
    return { ...slot, blocks: next };
  }
  let changed = false;
  const nextBlocks = slot.blocks.map((nb) => {
    if (nb.type === "container") {
      const nextChildren = mapStoryBlocksDeep(nb.children, (b) => fn(b as StoryColumnNestedBlock) as StoryBlock);
      if (nextChildren !== nb.children) {
        changed = true;
        return { ...nb, children: nextChildren };
      }
      return nb;
    }
    if (nb.type === "splitContent") {
      const ix = nb.supporting.blocks.findIndex((x) => x.id === childId);
      if (ix >= 0) {
        changed = true;
        const sb = [...nb.supporting.blocks];
        sb[ix] = fn(sb[ix] as StoryColumnNestedBlock) as StorySplitSupportBlock;
        return { ...nb, supporting: { ...nb.supporting, blocks: sb } };
      }
      let splitChanged = false;
      const sbNext = nb.supporting.blocks.map((sb) => {
        if (sb.type === "container") {
          const nextChildren = mapStoryBlocksDeep(sb.children, (b) => fn(b as StoryColumnNestedBlock) as StoryBlock);
          if (nextChildren !== sb.children) {
            splitChanged = true;
            return { ...sb, children: nextChildren };
          }
          return sb;
        }
        if (sb.type === "columns") {
          const c0 = patchColumnSlotDeep(sb.columns[0], childId, fn);
          const c1 = patchColumnSlotDeep(sb.columns[1], childId, fn);
          if (c0 !== sb.columns[0] || c1 !== sb.columns[1]) {
            splitChanged = true;
            return { ...sb, columns: columnPair(c0, c1) };
          }
        }
        return sb;
      });
      if (splitChanged) {
        changed = true;
        return { ...nb, supporting: { ...nb.supporting, blocks: sbNext } };
      }
      return nb;
    }
    if (nb.type !== "columns") return nb;
    const c0 = patchColumnSlotDeep(nb.columns[0], childId, fn);
    const c1 = patchColumnSlotDeep(nb.columns[1], childId, fn);
    if (c0 === nb.columns[0] && c1 === nb.columns[1]) return nb;
    changed = true;
    return { ...nb, columns: columnPair(c0, c1) };
  });
  return changed ? { ...slot, blocks: nextBlocks } : slot;
}

export function patchEmbedInSection(
  sec: StorySection,
  embedId: string,
  patch: Partial<StoryEmbedBlock>,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) =>
      b.type === "embed" && b.id === embedId ? { ...b, ...patch } : b,
    ),
  };
}

export function patchMediaInSection(
  sec: StorySection,
  mediaBlockId: string,
  patch: Partial<StoryMediaBlock>,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) =>
      b.type === "media" && b.id === mediaBlockId ? { ...b, ...patch } : b,
    ),
  };
}

export function patchRichTextInSection(
  sec: StorySection,
  richId: string,
  doc: JSONContent,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) => {
      if (b.type === "richText" && b.id === richId) {
        const next: StoryRichTextBlock = { ...b, doc };
        if (getStoryRichTextPreset(b) === "heading") {
          const inferred = inferFirstHeadingLevel(doc);
          if (inferred != null) next.headingLevel = inferred;
        }
        return next as StoryBlock;
      }
      if (b.type === "splitContent" && b.text.id === richId) {
        const t = b.text;
        const nextText: StoryRichTextBlock = { ...t, doc };
        if (getStoryRichTextPreset(t) === "heading") {
          const inferred = inferFirstHeadingLevel(doc);
          if (inferred != null) nextText.headingLevel = inferred;
        }
        return { ...b, text: nextText } as StoryBlock;
      }
      return b;
    }),
  };
}

export type StoryRichTextMetaPatch = Partial<
  Pick<
    StoryRichTextBlock,
    "preset" | "textPreset" | "headingLevel" | "listVariant" | "quoteAttribution" | "quoteStyle" | "verseSpacing"
  >
>;

function mergeRichTextMetaPatch(patch: StoryRichTextMetaPatch): StoryRichTextMetaPatch {
  const out = { ...patch };
  if (patch.preset != null && patch.textPreset === undefined) out.textPreset = patch.preset;
  if (patch.textPreset != null && patch.preset === undefined) out.preset = patch.textPreset;
  return out;
}

/** Locked rich-text blocks cannot change text preset (inspector / future callers). */
function richTextMetaPatchRespectingPresetLocks(
  b: StoryRichTextBlock,
  patch: StoryRichTextMetaPatch,
): StoryRichTextMetaPatch {
  if (!b.headingPresetLocked && !b.listPresetLocked) return mergeRichTextMetaPatch(patch);
  const merged = mergeRichTextMetaPatch(patch);
  const { preset: _p, textPreset: _t, ...rest } = merged;
  return rest;
}

function applyStoryRichTextMetaPatchToBlock(b: StoryRichTextBlock, merged: StoryRichTextMetaPatch): StoryRichTextBlock {
  let next: StoryRichTextBlock = { ...b, ...merged } as StoryRichTextBlock;
  const prevPreset = getStoryRichTextPreset(b);
  const preset = getStoryRichTextPreset(next);
  const presetTouched = merged.preset !== undefined || merged.textPreset !== undefined;

  if (prevPreset === "list" && preset !== "list" && presetTouched) {
    next = {
      ...next,
      doc: unwrapListItemsToParagraphDoc(b.doc as JSONContent) as JSONContent,
    };
  }

  const headingMetaTouched =
    merged.preset !== undefined || merged.textPreset !== undefined || merged.headingLevel !== undefined;
  if (preset === "heading" && headingMetaTouched) {
    const lvl = clampStoryRichTextHeadingLevel(next.headingLevel);
    const doc = applyHeadingLevelToRichTextDoc(next.doc as JSONContent, lvl);
    return {
      ...next,
      preset: next.preset ?? "heading",
      textPreset: next.textPreset ?? "heading",
      headingLevel: lvl,
      doc,
    };
  }

  if (preset === "list") {
    const listVariantNext = (next.listVariant ?? "bullet") as "bullet" | "ordered";
    const enteringList = prevPreset !== "list" && presetTouched;

    if (enteringList) {
      const doc = transformRichTextDocToList(b.doc as JSONContent, listVariantNext);
      return {
        ...next,
        preset: "list",
        textPreset: "list",
        listVariant: listVariantNext,
        doc,
      };
    }
    if (prevPreset === "list" && merged.listVariant !== undefined) {
      const doc = swapListVariantInDoc(b.doc as JSONContent, listVariantNext);
      return { ...next, listVariant: listVariantNext, doc };
    }
    return next;
  }

  return next;
}

/** Patch semantic rich-text fields anywhere in the section tree (incl. split primary text). */
export function patchRichTextMetaInSection(
  sec: StorySection,
  richTextBlockId: string,
  patch: StoryRichTextMetaPatch,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) => {
      if (b.type === "richText" && b.id === richTextBlockId) {
        const merged = richTextMetaPatchRespectingPresetLocks(b, patch);
        return applyStoryRichTextMetaPatchToBlock(b, merged) as StoryBlock;
      }
      if (b.type === "splitContent" && b.text.id === richTextBlockId) {
        const merged = richTextMetaPatchRespectingPresetLocks(b.text, patch);
        return { ...b, text: applyStoryRichTextMetaPatchToBlock(b.text, merged) } as StoryBlock;
      }
      return b;
    }),
  };
}

export type StoryDividerMetaPatch = Partial<
  Pick<StoryDividerBlock, "preset" | "variant" | "spacerRem" | "rowLayout" | "dividerThicknessPx" | "ornamentalStyle">
>;

function mergeDividerMetaPatch(patch: StoryDividerMetaPatch): StoryDividerMetaPatch {
  const out = { ...patch };
  if (patch.preset != null && patch.variant === undefined) out.variant = patch.preset;
  if (patch.variant != null && patch.preset === undefined) out.preset = patch.variant;
  return out;
}

export function patchDividerBlockInSection(sec: StorySection, dividerId: string, patch: StoryDividerMetaPatch): StorySection {
  const merged = mergeDividerMetaPatch(patch);
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) =>
      b.type === "divider" && b.id === dividerId ? ({ ...b, ...merged } as StoryBlock) : b,
    ),
  };
}

export function patchBlockDateAnnotationInSection(
  sec: StorySection,
  blockId: string,
  dateAnnotation: StoryBlockDateAnnotation | undefined,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) =>
      b.id === blockId ? ({ ...b, dateAnnotation } as StoryBlock) : b,
    ),
  };
}

/** Deep-merge `rowLayout` for rich text / media / embed, or `props.rowLayout` for containers. */
/** Set or clear per-block `design` (scoped CSS / custom class) anywhere in the section tree. */
export function patchBlockDesignInSection(
  sec: StorySection,
  blockId: string,
  patch: Partial<StoryBlockDesign> | null,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) => {
      if (b.id !== blockId) return b;
      const nextDesign = mergeStoryBlockDesign(b.design, patch);
      if (nextDesign == null) return withoutBlockDesign(b);
      return { ...b, design: nextDesign } as StoryBlock;
    }),
  };
}

export function patchBlockRowLayoutInSection(
  sec: StorySection,
  blockId: string,
  patch: Partial<StoryBlockRowLayout>,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) => {
      if (b.id !== blockId) return b;
      if (b.type === "richText") {
        const nextRow: StoryBlockRowLayout = { ...b.rowLayout, ...patch, displayMode: "block", float: undefined };
        return { ...b, rowLayout: nextRow } as StoryBlock;
      }
      if (b.type === "media" || b.type === "embed") {
        return { ...b, rowLayout: { ...b.rowLayout, ...patch } };
      }
      if (b.type === "container") {
        return { ...b, props: { ...b.props, rowLayout: { ...b.props.rowLayout, ...patch } } };
      }
      if (b.type === "divider") {
        return { ...b, rowLayout: { ...b.rowLayout, ...patch } } as StoryBlock;
      }
      return b;
    }),
  };
}

function mergeContainerPropsPatch(prev: StoryContainerBlockProps, patch: Partial<StoryContainerBlockProps>): StoryContainerBlockProps {
  const next: StoryContainerBlockProps = { ...prev, ...patch };
  if (patch.preset != null) {
    next.preset = patch.preset;
    next.containerPreset = patch.preset;
  } else if (patch.containerPreset != null) {
    next.containerPreset = patch.containerPreset;
    next.preset = patch.containerPreset;
  }
  return next;
}

function containerPropsPatchRespectingPresetLock(
  b: StoryContainerBlock,
  propsPatch: Partial<StoryContainerBlockProps>,
): Partial<StoryContainerBlockProps> {
  if (!b.containerPresetLocked) return propsPatch;
  if (propsPatch.preset == null && propsPatch.containerPreset == null) return propsPatch;
  const { preset: _p, containerPreset: _c, ...rest } = propsPatch;
  return rest;
}

export function patchContainerInSection(
  sec: StorySection,
  containerId: string,
  propsPatch: Partial<StoryContainerBlockProps>,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) => {
      if (b.type !== "container" || b.id !== containerId) return b;
      const patch = containerPropsPatchRespectingPresetLock(b, propsPatch);
      return { ...b, props: mergeContainerPropsPatch(b.props, patch) };
    }),
  };
}

function patchNestedColumnsBlock(
  block: StoryColumnsBlock,
  columnsBlockId: string,
  patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem">>,
): StoryColumnsBlock {
  if (block.id === columnsBlockId) return { ...block, ...patch };
  return {
    ...block,
    columns: [
      {
        ...block.columns[0],
        blocks: mapColumnNestedDeep(block.columns[0].blocks, (b) =>
          b.type === "columns" ? patchNestedColumnsBlock(b, columnsBlockId, patch) : b,
        ),
      },
      {
        ...block.columns[1],
        blocks: mapColumnNestedDeep(block.columns[1].blocks, (b) =>
          b.type === "columns" ? patchNestedColumnsBlock(b, columnsBlockId, patch) : b,
        ),
      },
    ],
  };
}

export function patchColumnsInSection(
  sec: StorySection,
  columnsBlockId: string,
  patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem">>,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) =>
      b.type === "columns" ? patchNestedColumnsBlock(b, columnsBlockId, patch) : b,
    ),
  };
}

function patchColumnSlotLayoutInBlock(
  block: StoryColumnsBlock,
  columnsBlockId: string,
  columnIndex: 0 | 1,
  patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>,
): StoryColumnsBlock {
  if (block.id === columnsBlockId) {
    const cols: [StoryColumnSlot, StoryColumnSlot] = [...block.columns];
    cols[columnIndex] = { ...cols[columnIndex], ...patch };
    return { ...block, columns: cols };
  }
  return {
    ...block,
    columns: [
      {
        ...block.columns[0],
        blocks: mapColumnNestedDeep(block.columns[0].blocks, (b) =>
          b.type === "columns" ? patchColumnSlotLayoutInBlock(b, columnsBlockId, columnIndex, patch) : b,
        ),
      },
      {
        ...block.columns[1],
        blocks: mapColumnNestedDeep(block.columns[1].blocks, (b) =>
          b.type === "columns" ? patchColumnSlotLayoutInBlock(b, columnsBlockId, columnIndex, patch) : b,
        ),
      },
    ],
  };
}

export function patchColumnSlotLayout(
  sec: StorySection,
  columnsBlockId: string,
  columnIndex: 0 | 1,
  patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>,
): StorySection {
  return {
    ...sec,
    blocks: mapStoryBlocksDeep(sec.blocks, (b) =>
      b.type === "columns" ? patchColumnSlotLayoutInBlock(b, columnsBlockId, columnIndex, patch) : b,
    ),
  };
}

function insertIntoStoryBlocksForColumnsInsert(
  blocks: StoryBlock[],
  columnsBlockId: string,
  columnIndex: 0 | 1,
  atIndex: number,
  nested: StoryColumnNestedBlock,
): StoryBlock[] {
  let changed = false;
  const next = blocks.map((b) => {
    if (b.type === "columns") {
      const nextCol = insertIntoColumnsBlock(b, columnsBlockId, columnIndex, atIndex, nested);
      if (nextCol !== b) {
        changed = true;
        return nextCol;
      }
    }
    if (b.type === "container") {
      const nextChildren = insertIntoStoryBlocksForColumnsInsert(
        b.children,
        columnsBlockId,
        columnIndex,
        atIndex,
        nested,
      );
      if (nextChildren !== b.children) {
        changed = true;
        return { ...b, children: nextChildren };
      }
    }
    return b;
  });
  return changed ? next : blocks;
}

function insertIntoColumnNestedListForColumnsInsert(
  blocks: StoryColumnNestedBlock[],
  columnsBlockId: string,
  columnIndex: 0 | 1,
  atIndex: number,
  nested: StoryColumnNestedBlock,
): StoryColumnNestedBlock[] {
  let changed = false;
  const next = blocks.map((nb) => {
    if (nb.type === "container") {
      const nextChildren = insertIntoStoryBlocksForColumnsInsert(
        nb.children,
        columnsBlockId,
        columnIndex,
        atIndex,
        nested,
      );
      if (nextChildren !== nb.children) {
        changed = true;
        return { ...nb, children: nextChildren };
      }
    }
    if (nb.type === "columns") {
      const nextCol = insertIntoColumnsBlock(nb, columnsBlockId, columnIndex, atIndex, nested);
      if (nextCol !== nb) {
        changed = true;
        return nextCol;
      }
    }
    return nb;
  });
  return changed ? next : blocks;
}

function insertIntoColumnsBlock(
  block: StoryColumnsBlock,
  columnsBlockId: string,
  columnIndex: 0 | 1,
  atIndex: number,
  nested: StoryColumnNestedBlock,
): StoryColumnsBlock {
  if (block.id === columnsBlockId) {
    const cols: [StoryColumnSlot, StoryColumnSlot] = [...block.columns];
    const slot = cols[columnIndex];
    const blocks = [...slot.blocks];
    const i = Math.max(0, Math.min(atIndex, blocks.length));
    blocks.splice(i, 0, nested);
    cols[columnIndex] = { ...slot, blocks };
    return { ...block, columns: cols };
  }
  const c0 = insertIntoColumnNestedListForColumnsInsert(
    block.columns[0].blocks,
    columnsBlockId,
    columnIndex,
    atIndex,
    nested,
  );
  const c1 = insertIntoColumnNestedListForColumnsInsert(
    block.columns[1].blocks,
    columnsBlockId,
    columnIndex,
    atIndex,
    nested,
  );
  if (c0 === block.columns[0].blocks && c1 === block.columns[1].blocks) return block;
  return {
    ...block,
    columns: [
      { ...block.columns[0], blocks: c0 },
      { ...block.columns[1], blocks: c1 },
    ],
  };
}

/** Insert or append a nested block inside a column (`atIndex` 0 = top). */
export function insertColumnNestedAt(
  sec: StorySection,
  columnsBlockId: string,
  columnIndex: 0 | 1,
  atIndex: number,
  nested: StoryColumnNestedBlock,
): StorySection {
  if (nested.type === "columns") {
    const depth = columnsBlockDepthInSection(sec, columnsBlockId);
    if (depth == null || depth >= MAX_STORY_COLUMNS_NEST_DEPTH) {
      return sec;
    }
  }
  return {
    ...sec,
    blocks: sec.blocks.map((b) => {
      if (b.type === "columns") {
        return insertIntoColumnsBlock(b, columnsBlockId, columnIndex, atIndex, nested);
      }
      if (b.type === "container") {
        const nextChildren = insertIntoStoryBlocksForColumnsInsert(
          b.children,
          columnsBlockId,
          columnIndex,
          atIndex,
          nested,
        );
        return nextChildren !== b.children ? { ...b, children: nextChildren } : b;
      }
      return b;
    }),
  };
}

export function insertBlockAtIndex(sec: StorySection, index: number, block: StoryBlock): StorySection {
  const blocks = [...sec.blocks];
  const i = Math.max(0, Math.min(index, blocks.length));
  blocks.splice(i, 0, block);
  return { ...sec, blocks };
}

type RemoveFromColumnsResult = {
  next: StoryColumnsBlock;
  nextSelectedId: string | null;
  removed: boolean;
};

type RemoveFromStoryBlocksResult = {
  next: StoryBlock[];
  removed: boolean;
  nextSelectedId: string | null;
};

function removeFromStoryBlocksDeep(blocks: StoryBlock[], targetId: string): RemoveFromStoryBlocksResult {
  const ix = blocks.findIndex((b) => b.id === targetId);
  if (ix >= 0) {
    const next = blocks.filter((_, j) => j !== ix);
    const nextSelectedId =
      next.length > 0 ? (ix < next.length ? next[ix]!.id : next[ix - 1]!.id) : null;
    return { next, removed: true, nextSelectedId };
  }
  let changed = false;
  let sel: string | null = null;
  const next = blocks.map((b) => {
    if (b.type === "container") {
      const r = removeFromStoryBlocksDeep(b.children, targetId);
      if (r.removed) {
        changed = true;
        sel = r.nextSelectedId;
        return { ...b, children: r.next };
      }
    }
    if (b.type === "splitContent") {
      if (b.text.id === targetId) {
        return b;
      }
      const r = removeFromStoryBlocksDeep(b.supporting.blocks as StoryBlock[], targetId);
      if (r.removed) {
        changed = true;
        sel = r.nextSelectedId ?? b.id;
        return { ...b, supporting: { ...b.supporting, blocks: r.next as StorySplitSupportBlock[] } };
      }
    }
    if (b.type === "columns") {
      const r = removeFromNestedColumnTree(b, targetId);
      if (r.removed) {
        changed = true;
        sel = r.nextSelectedId;
        return r.next;
      }
    }
    return b;
  });
  return changed ? { next, removed: true, nextSelectedId: sel } : { next: blocks, removed: false, nextSelectedId: null };
}

function removeFromNestedColumnTree(block: StoryColumnsBlock, targetId: string): RemoveFromColumnsResult {
  for (let col = 0; col < 2; col++) {
    const slot = block.columns[col];
    const ix = slot.blocks.findIndex((nb) => nb.id === targetId);
    if (ix >= 0) {
      const nextBlocks = slot.blocks.filter((_, j) => j !== ix);
      const cols: [StoryColumnSlot, StoryColumnSlot] = [...block.columns];
      cols[col] = { ...slot, blocks: nextBlocks };
      const nextSelectedId =
        nextBlocks.length > 0 ? (ix < nextBlocks.length ? nextBlocks[ix]!.id : nextBlocks[ix - 1]!.id) : block.id;
      return { next: { ...block, columns: cols }, nextSelectedId, removed: true };
    }
  }
  const cols: [StoryColumnSlot, StoryColumnSlot] = [...block.columns];
  for (let col = 0; col < 2; col++) {
    const slot = cols[col];
    for (let j = 0; j < slot.blocks.length; j++) {
      const nb = slot.blocks[j]!;
      if (nb.type === "container") {
        const inner = removeFromStoryBlocksDeep(nb.children, targetId);
        if (inner.removed) {
          const nextBlocks = [...slot.blocks];
          nextBlocks[j] = { ...nb, children: inner.next };
          cols[col] = { ...slot, blocks: nextBlocks };
          const nextSelectedId = inner.nextSelectedId ?? nb.id;
          return { next: { ...block, columns: cols }, nextSelectedId, removed: true };
        }
      }
      if (nb.type === "splitContent") {
        if (nb.text.id === targetId) continue;
        const inner = removeFromStoryBlocksDeep(nb.supporting.blocks as StoryBlock[], targetId);
        if (inner.removed) {
          const nextBlocks = [...slot.blocks];
          nextBlocks[j] = {
            ...nb,
            supporting: { ...nb.supporting, blocks: inner.next as StorySplitSupportBlock[] },
          };
          cols[col] = { ...slot, blocks: nextBlocks };
          const nextSelectedId = inner.nextSelectedId ?? nb.id;
          return { next: { ...block, columns: cols }, nextSelectedId, removed: true };
        }
      }
      if (nb.type !== "columns") continue;
      const inner = removeFromNestedColumnTree(nb, targetId);
      if (inner.removed) {
        const nextBlocks = [...slot.blocks];
        nextBlocks[j] = inner.next;
        cols[col] = { ...slot, blocks: nextBlocks };
        return { next: { ...block, columns: cols }, nextSelectedId: inner.nextSelectedId, removed: true };
      }
    }
  }
  return { next: block, nextSelectedId: null, removed: false };
}

export function removeBlockById(
  sec: StorySection,
  blockId: string,
): { section: StorySection; nextSelectedId: string | null } | null {
  const topIdx = sec.blocks.findIndex((b) => b.id === blockId);
  if (topIdx >= 0) {
    const filtered = sec.blocks.filter((b) => b.id !== blockId);
    let nextSelectedId: string | null = null;
    if (filtered.length > 0) {
      nextSelectedId = topIdx < filtered.length ? filtered[topIdx]!.id : filtered[topIdx - 1]!.id;
    }
    return { section: { ...sec, blocks: filtered }, nextSelectedId };
  }
  let changed = false;
  let nextSelectedId: string | null = null;
  const nextBlocks = sec.blocks.map((b) => {
    if (b.type === "container") {
      const r = removeFromStoryBlocksDeep(b.children, blockId);
      if (r.removed) {
        changed = true;
        nextSelectedId = r.nextSelectedId ?? b.id;
        return { ...b, children: r.next };
      }
    }
    if (b.type === "splitContent") {
      const r = removeFromStoryBlocksDeep(b.supporting.blocks as StoryBlock[], blockId);
      if (r.removed) {
        changed = true;
        nextSelectedId = r.nextSelectedId ?? b.id;
        return { ...b, supporting: { ...b.supporting, blocks: r.next as StorySplitSupportBlock[] } };
      }
    }
    if (b.type === "columns") {
      const r = removeFromNestedColumnTree(b, blockId);
      if (r.removed) {
        changed = true;
        nextSelectedId = r.nextSelectedId;
        return r.next;
      }
    }
    return b;
  });
  if (changed) {
    return { section: { ...sec, blocks: nextBlocks }, nextSelectedId };
  }
  return null;
}

/** Where a nested block lives inside the column tree (innermost columns block that owns the slot). */
export type ColumnNestedPlacement = {
  columnsBlockId: string;
  columnIndex: 0 | 1;
  blockIndex: number;
};

function findColumnNestedPlacementInBlock(
  block: StoryColumnsBlock,
  blockId: string,
): ColumnNestedPlacement | null {
  for (let col = 0; col < 2; col++) {
    const slot = block.columns[col];
    const ix = slot.blocks.findIndex((nb) => nb.id === blockId);
    if (ix >= 0) {
      return { columnsBlockId: block.id, columnIndex: col as 0 | 1, blockIndex: ix };
    }
  }
  for (let col = 0; col < 2; col++) {
    for (const nb of block.columns[col].blocks) {
      if (nb.type === "container") {
        if (findStoryBlockPlacementInList(nb.children, blockId) != null) {
          const ix = block.columns[col].blocks.findIndex((x) => x.id === nb.id);
          if (ix >= 0) return { columnsBlockId: block.id, columnIndex: col as 0 | 1, blockIndex: ix };
        }
      }
      if (nb.type === "splitContent") {
        if (nb.text.id === blockId) {
          const ix = block.columns[col].blocks.findIndex((x) => x.id === nb.id);
          if (ix >= 0) return { columnsBlockId: block.id, columnIndex: col as 0 | 1, blockIndex: ix };
        }
        if (findStoryBlockPlacementInList(nb.supporting.blocks as StoryBlock[], blockId) != null) {
          const ix = block.columns[col].blocks.findIndex((x) => x.id === nb.id);
          if (ix >= 0) return { columnsBlockId: block.id, columnIndex: col as 0 | 1, blockIndex: ix };
        }
      }
      if (nb.type === "columns") {
        const inner = findColumnNestedPlacementInBlock(nb, blockId);
        if (inner) return inner;
      }
    }
  }
  return null;
}

/** Index of the top-level column slot row whose subtree contains `blockId` (for legacy placement APIs). */
function findStoryBlockPlacementInList(blocks: StoryBlock[], blockId: string): number | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.id === blockId) return i;
    if (b.type === "container") {
      const inner = findStoryBlockPlacementInList(b.children, blockId);
      if (inner != null) return i;
    }
    if (b.type === "columns") {
      for (const slot of b.columns) {
        for (const nb of slot.blocks) {
          if (nb.id === blockId) return i;
          if (nb.type === "container" && findStoryBlockPlacementInList(nb.children, blockId) != null) return i;
          if (
            nb.type === "splitContent" &&
            (nb.text.id === blockId ||
              findStoryBlockPlacementInList(nb.supporting.blocks as StoryBlock[], blockId) != null)
          )
            return i;
          if (nb.type === "columns" && findColumnNestedPlacementInBlock(nb, blockId)) return i;
        }
      }
    }
    if (b.type === "splitContent") {
      if (b.text.id === blockId) return i;
      if (findStoryBlockPlacementInList(b.supporting.blocks as StoryBlock[], blockId) != null) return i;
    }
  }
  return null;
}

/** Find placement of a block inside a column cell (any nesting depth). */
export function findColumnNestedPlacement(sec: StorySection, blockId: string): ColumnNestedPlacement | null {
  for (const b of sec.blocks) {
    if (b.type !== "columns") continue;
    const hit = findColumnNestedPlacementInBlock(b, blockId);
    if (hit) return hit;
  }
  return null;
}

function findInnermostColumnsBlockContainingTargetInColumns(
  block: StoryColumnsBlock,
  targetBlockId: string,
): StoryColumnsBlock | null {
  for (const slot of block.columns) {
    for (const nb of slot.blocks) {
      if (nb.id === targetBlockId) return block;
      if (nb.type === "container" && findStoryBlockPlacementInList(nb.children, targetBlockId) != null) {
        return block;
      }
      if (nb.type === "splitContent") {
        if (nb.text.id === targetBlockId) return block;
        if (findStoryBlockPlacementInList(nb.supporting.blocks as StoryBlock[], targetBlockId) != null) return block;
      }
      if (nb.type === "columns") {
        const inner = findInnermostColumnsBlockContainingTargetInColumns(nb, targetBlockId);
        if (inner) return inner;
      }
    }
  }
  return null;
}

/** Columns block whose cell (including containers inside the cell) contains `targetBlockId`. */
export function findInnermostColumnsBlockContainingTargetBlock(
  sec: StorySection,
  targetBlockId: string,
): StoryColumnsBlock | null {
  for (const b of sec.blocks) {
    if (b.type !== "columns") continue;
    const hit = findInnermostColumnsBlockContainingTargetInColumns(b, targetBlockId);
    if (hit) return hit;
  }
  return null;
}

function tryInsertInSplitContent(
  split: StorySplitContentBlock,
  targetBlockId: string,
  position: "above" | "below",
  insert: StoryBlock,
): StorySplitContentBlock | null {
  if (split.text.id === targetBlockId) return null;
  const ix = split.supporting.blocks.findIndex((sb) => sb.id === targetBlockId);
  if (ix >= 0) {
    const at = position === "above" ? ix : ix + 1;
    const nextSb = [...split.supporting.blocks];
    nextSb.splice(at, 0, insert as StorySplitSupportBlock);
    return { ...split, supporting: { ...split.supporting, blocks: nextSb } };
  }
  let any = false;
  const nextSb = split.supporting.blocks.map((sb) => {
    if (sb.type === "container") {
      const inner = tryInsertInStoryBlocks(sb.children, targetBlockId, position, insert);
      if (inner) {
        any = true;
        return { ...sb, children: inner };
      }
    }
    if (sb.type === "columns") {
      const inner = tryInsertInColumnTree(sb, targetBlockId, position, insert as StoryColumnNestedBlock);
      if (inner) {
        any = true;
        return inner;
      }
    }
    return sb;
  });
  return any ? { ...split, supporting: { ...split.supporting, blocks: nextSb } } : null;
}

function tryInsertInColumnNestedSlotList(
  blocks: StoryColumnNestedBlock[],
  targetBlockId: string,
  position: "above" | "below",
  insert: StoryColumnNestedBlock,
): StoryColumnNestedBlock[] | null {
  const i = blocks.findIndex((nb) => nb.id === targetBlockId);
  if (i >= 0) {
    const at = position === "above" ? i : i + 1;
    const next = [...blocks];
    next.splice(at, 0, insert);
    return next;
  }
  let any = false;
  const next = blocks.map((nb) => {
    if (nb.type === "container") {
      const inner = tryInsertInStoryBlocks(nb.children, targetBlockId, position, insert as StoryBlock);
      if (inner) {
        any = true;
        return { ...nb, children: inner };
      }
    }
    if (nb.type === "splitContent") {
      const s = tryInsertInSplitContent(nb, targetBlockId, position, insert as StoryBlock);
      if (s) {
        any = true;
        return s;
      }
    }
    if (nb.type === "columns") {
      const inner = tryInsertInColumnTree(nb, targetBlockId, position, insert);
      if (inner) {
        any = true;
        return inner;
      }
    }
    return nb;
  });
  return any ? next : null;
}

function tryInsertInColumnTree(
  block: StoryColumnsBlock,
  targetBlockId: string,
  position: "above" | "below",
  insert: StoryColumnNestedBlock,
): StoryColumnsBlock | null {
  for (let col = 0; col < 2; col++) {
    const slot = block.columns[col];
    const ix = slot.blocks.findIndex((nb) => nb.id === targetBlockId);
    if (ix >= 0) {
      const at = position === "above" ? ix : ix + 1;
      const nextBlocks = [...slot.blocks];
      nextBlocks.splice(at, 0, insert);
      const cols: [StoryColumnSlot, StoryColumnSlot] = [...block.columns];
      cols[col] = { ...slot, blocks: nextBlocks };
      return { ...block, columns: cols };
    }
  }
  const c0 = block.columns[0];
  const c1 = block.columns[1];
  const n0 = tryInsertInColumnNestedSlotList(c0.blocks, targetBlockId, position, insert);
  if (n0) {
    return { ...block, columns: [{ ...c0, blocks: n0 }, c1] };
  }
  const n1 = tryInsertInColumnNestedSlotList(c1.blocks, targetBlockId, position, insert);
  if (n1) {
    return { ...block, columns: [c0, { ...c1, blocks: n1 }] };
  }
  return null;
}

function tryInsertInStoryBlocks(
  blocks: StoryBlock[],
  targetBlockId: string,
  position: "above" | "below",
  insert: StoryBlock,
): StoryBlock[] | null {
  const i = blocks.findIndex((b) => b.id === targetBlockId);
  if (i >= 0) {
    const at = position === "above" ? i : i + 1;
    const next = [...blocks];
    next.splice(at, 0, insert);
    return next;
  }
  let any = false;
  const next = blocks.map((b) => {
    if (b.type === "container") {
      const inner = tryInsertInStoryBlocks(b.children, targetBlockId, position, insert);
      if (inner) {
        any = true;
        return { ...b, children: inner };
      }
    }
    if (b.type === "splitContent") {
      const s = tryInsertInSplitContent(b, targetBlockId, position, insert);
      if (s) {
        any = true;
        return s;
      }
    }
    if (b.type === "columns") {
      const inner = tryInsertInColumnTree(b, targetBlockId, position, insert as StoryColumnNestedBlock);
      if (inner) {
        any = true;
        return inner;
      }
    }
    return b;
  });
  return any ? next : null;
}

function findInStoryBlock(b: StoryBlock, id: string): StoryBlock | null {
  if (b.id === id) return b;
  if (b.type === "container") {
    for (const c of b.children) {
      const h = findInStoryBlock(c, id);
      if (h) return h;
    }
    return null;
  }
  if (b.type === "splitContent") {
    if (b.text.id === id) return b.text as StoryBlock;
    for (const sb of b.supporting.blocks) {
      const h = findInStoryBlock(sb as StoryBlock, id);
      if (h) return h;
    }
    return null;
  }
  if (b.type === "columns") {
    for (const slot of b.columns) {
      for (const nb of slot.blocks) {
        if (nb.id === id) return nb as StoryBlock;
        if (nb.type === "container") {
          for (const c of nb.children) {
            const h = findInStoryBlock(c, id);
            if (h) return h;
          }
        }
        if (nb.type === "columns") {
          for (const s of nb.columns) {
            for (const inner of s.blocks) {
              const h = findInColumnNestedAsStoryBlock(inner, id);
              if (h) return h;
            }
          }
        }
      }
    }
  }
  return null;
}

function findInColumnNestedAsStoryBlock(nb: StoryColumnNestedBlock, id: string): StoryBlock | null {
  if (nb.id === id) return nb as StoryBlock;
  if (nb.type === "splitContent") {
    if (nb.text.id === id) return nb.text as StoryBlock;
    for (const sb of nb.supporting.blocks) {
      const h = findInStoryBlock(sb as StoryBlock, id);
      if (h) return h;
    }
    return null;
  }
  if (nb.type === "container") {
    for (const c of nb.children) {
      const h = findInStoryBlock(c, id);
      if (h) return h;
    }
    return null;
  }
  if (nb.type === "columns") {
    for (const slot of nb.columns) {
      for (const inner of slot.blocks) {
        const h = findInColumnNestedAsStoryBlock(inner, id);
        if (h) return h;
      }
    }
  }
  return null;
}

/** Find a block by id anywhere in the section tree (including inside columns and containers). */
export function findStoryBlockAnywhere(sec: StorySection, id: string): StoryBlock | null {
  for (const b of sec.blocks) {
    const h = findInStoryBlock(b, id);
    if (h) return h;
  }
  return null;
}

/**
 * Insert a new block immediately above or below an existing block (section-level or inside columns).
 * Returns `null` if the target id was not found, or a nested columns insert was rejected (max depth).
 */
export function insertBlockRelativeToBlockId(
  sec: StorySection,
  targetBlockId: string,
  position: "above" | "below",
  block: StoryBlock | StoryColumnNestedBlock,
): StorySection | null {
  const insertB = block as StoryBlock;
  if (insertB.type === "columns") {
    const owner = findInnermostColumnsBlockContainingTargetBlock(sec, targetBlockId);
    if (owner) {
      const depth = columnsBlockDepthInSection(sec, owner.id);
      if (depth == null || depth >= MAX_STORY_COLUMNS_NEST_DEPTH) {
        return null;
      }
    }
  }
  const next = tryInsertInStoryBlocks(sec.blocks, targetBlockId, position, insertB);
  return next ? { ...sec, blocks: next } : null;
}

/**
 * Duplicate a block above or below itself. New ids are assigned throughout the clone.
 * Returns `null` if the target was not found or a nested columns duplicate could not be inserted.
 */
export function duplicateBlockRelativeToBlockId(
  sec: StorySection,
  targetBlockId: string,
  position: "above" | "below",
): { section: StorySection; duplicateId: string } | null {
  const original = findStoryBlockAnywhere(sec, targetBlockId);
  if (!original) return null;
  const clone = cloneStoryBlock(original);
  const next = insertBlockRelativeToBlockId(sec, targetBlockId, position, clone);
  if (!next) return null;
  return { section: next, duplicateId: clone.id };
}

function appendBlockIntoContainerInColumns(
  colBlock: StoryColumnsBlock,
  containerId: string,
  block: StoryBlock,
): StoryColumnsBlock | null {
  const n0 = appendBlockIntoContainerInSlot(colBlock.columns[0].blocks, containerId, block);
  if (n0) {
    return {
      ...colBlock,
      columns: [{ ...colBlock.columns[0], blocks: n0 }, colBlock.columns[1]],
    };
  }
  const n1 = appendBlockIntoContainerInSlot(colBlock.columns[1].blocks, containerId, block);
  if (n1) {
    return {
      ...colBlock,
      columns: [colBlock.columns[0], { ...colBlock.columns[1], blocks: n1 }],
    };
  }
  return null;
}

function appendBlockIntoContainerInSlot(
  blocks: StoryColumnNestedBlock[],
  containerId: string,
  block: StoryBlock,
): StoryColumnNestedBlock[] | null {
  let any = false;
  const next = blocks.map((nb) => {
    if (nb.type === "container" && nb.id === containerId) {
      any = true;
      return { ...nb, children: [...nb.children, block] };
    }
    if (nb.type === "container") {
      const inner = appendBlockIntoContainerDeep(nb.children, containerId, block);
      if (inner) {
        any = true;
        return { ...nb, children: inner };
      }
    }
    if (nb.type === "columns") {
      const inner = appendBlockIntoContainerInColumns(nb, containerId, block);
      if (inner) {
        any = true;
        return inner;
      }
    }
    if (nb.type === "splitContent") {
      const inner = appendBlockIntoContainerDeep(nb.supporting.blocks as StoryBlock[], containerId, block);
      if (inner) {
        any = true;
        return { ...nb, supporting: { ...nb.supporting, blocks: inner as StorySplitSupportBlock[] } };
      }
    }
    return nb;
  });
  return any ? next : null;
}

function appendBlockIntoContainerDeep(
  blocks: StoryBlock[],
  containerId: string,
  block: StoryBlock,
): StoryBlock[] | null {
  let any = false;
  const next = blocks.map((b) => {
    if (b.type === "container" && b.id === containerId) {
      any = true;
      return { ...b, children: [...b.children, block] };
    }
    if (b.type === "container") {
      const inner = appendBlockIntoContainerDeep(b.children, containerId, block);
      if (inner) {
        any = true;
        return { ...b, children: inner };
      }
    }
    if (b.type === "columns") {
      const inner = appendBlockIntoContainerInColumns(b, containerId, block);
      if (inner) {
        any = true;
        return inner;
      }
    }
    if (b.type === "splitContent") {
      const inner = appendBlockIntoContainerDeep(b.supporting.blocks as StoryBlock[], containerId, block);
      if (inner) {
        any = true;
        return {
          ...b,
          supporting: { ...b.supporting, blocks: inner as StorySplitSupportBlock[] },
        };
      }
    }
    return b;
  });
  return any ? next : null;
}

function appendSupportingToSplitInColumns(
  colBlock: StoryColumnsBlock,
  splitBlockId: string,
  insert: StorySplitSupportBlock,
): StoryColumnsBlock | null {
  const n0 = appendSupportingToSplitInSlot(colBlock.columns[0].blocks, splitBlockId, insert);
  if (n0) {
    return {
      ...colBlock,
      columns: [{ ...colBlock.columns[0], blocks: n0 }, colBlock.columns[1]],
    };
  }
  const n1 = appendSupportingToSplitInSlot(colBlock.columns[1].blocks, splitBlockId, insert);
  if (n1) {
    return {
      ...colBlock,
      columns: [colBlock.columns[0], { ...colBlock.columns[1], blocks: n1 }],
    };
  }
  return null;
}

function appendSupportingToSplitInSlot(
  blocks: StoryColumnNestedBlock[],
  splitBlockId: string,
  insert: StorySplitSupportBlock,
): StoryColumnNestedBlock[] | null {
  let any = false;
  const next = blocks.map((nb) => {
    if (nb.type === "splitContent" && nb.id === splitBlockId) {
      any = true;
      return {
        ...nb,
        supporting: { ...nb.supporting, blocks: [...nb.supporting.blocks, insert] },
      };
    }
    if (nb.type === "splitContent") {
      const inner = appendSupportingToSplitDeep(nb.supporting.blocks as StoryBlock[], splitBlockId, insert);
      if (inner) {
        any = true;
        return { ...nb, supporting: { ...nb.supporting, blocks: inner as StorySplitSupportBlock[] } };
      }
    }
    if (nb.type === "container") {
      const inner = appendSupportingToSplitDeep(nb.children, splitBlockId, insert);
      if (inner) {
        any = true;
        return { ...nb, children: inner };
      }
    }
    if (nb.type === "columns") {
      const inner = appendSupportingToSplitInColumns(nb, splitBlockId, insert);
      if (inner) {
        any = true;
        return inner;
      }
    }
    return nb;
  });
  return any ? next : null;
}

function appendSupportingToSplitDeep(
  blocks: StoryBlock[],
  splitBlockId: string,
  insert: StorySplitSupportBlock,
): StoryBlock[] | null {
  let any = false;
  const next = blocks.map((b) => {
    if (b.type === "splitContent" && b.id === splitBlockId) {
      any = true;
      return {
        ...b,
        supporting: { ...b.supporting, blocks: [...b.supporting.blocks, insert] },
      };
    }
    if (b.type === "splitContent") {
      const inner = appendSupportingToSplitDeep(b.supporting.blocks as StoryBlock[], splitBlockId, insert);
      if (inner) {
        any = true;
        return { ...b, supporting: { ...b.supporting, blocks: inner as StorySplitSupportBlock[] } };
      }
    }
    if (b.type === "container") {
      const inner = appendSupportingToSplitDeep(b.children, splitBlockId, insert);
      if (inner) {
        any = true;
        return { ...b, children: inner };
      }
    }
    if (b.type === "columns") {
      const inner = appendSupportingToSplitInColumns(b, splitBlockId, insert);
      if (inner) {
        any = true;
        return inner;
      }
    }
    return b;
  });
  return any ? next : null;
}

/** Append a supporting-only block to a split block’s rail (any depth). */
export function appendSupportingBlockToSplit(
  sec: StorySection,
  splitBlockId: string,
  block: StorySplitSupportBlock,
): StorySection | null {
  const next = appendSupportingToSplitDeep(sec.blocks, splitBlockId, block);
  return next ? { ...sec, blocks: next } : null;
}

/** Append a block as the last child of the container with `containerId` (any depth). */
export function appendBlockIntoContainer(
  sec: StorySection,
  containerId: string,
  block: StoryBlock,
): StorySection | null {
  const next = appendBlockIntoContainerDeep(sec.blocks, containerId, block);
  return next ? { ...sec, blocks: next } : null;
}

export { moveStoryBlockRelative } from "./story-block-move-relative";
