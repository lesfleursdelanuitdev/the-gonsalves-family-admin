import type {
  StoryBlock,
  StoryColumnNestedBlock,
  StoryColumnsBlock,
  StorySection,
} from "@/lib/admin/story-creator/story-types";

export type StorySelection =
  | { mode: "section"; block: StoryBlock }
  | { mode: "column"; columnsBlock: StoryColumnsBlock; columnIndex: 0 | 1; block: StoryColumnNestedBlock };

type ColumnPick = {
  columnsBlock: StoryColumnsBlock;
  columnIndex: 0 | 1;
  block: StoryColumnNestedBlock;
  depth: number;
};

function findBlockInColumnCellContext(
  b: StoryBlock,
  columnsBlock: StoryColumnsBlock,
  columnIndex: 0 | 1,
  depth: number,
  id: string,
): ColumnPick | null {
  if (b.id === id) {
    return { columnsBlock, columnIndex, block: b as StoryColumnNestedBlock, depth };
  }
  if (b.type === "container") {
    let best: ColumnPick | null = null;
    for (const c of b.children) {
      const hit = findBlockInColumnCellContext(c, columnsBlock, columnIndex, depth + 1, id);
      if (hit && (!best || hit.depth >= best.depth)) best = hit;
    }
    return best;
  }
  if (b.type === "splitContent") {
    if (b.text.id === id) {
      return { columnsBlock, columnIndex, block: b.text as StoryColumnNestedBlock, depth: depth + 1 };
    }
    for (const sb of b.supporting.blocks) {
      const hit = findBlockInColumnCellContext(sb as StoryBlock, columnsBlock, columnIndex, depth + 1, id);
      if (hit) return hit;
    }
    return null;
  }
  if (b.type === "columns") {
    return findInnermostColumnSelection(b, id, depth + 1);
  }
  return null;
}

function findInnermostColumnSelection(columnsBlock: StoryColumnsBlock, id: string, depth: number): ColumnPick | null {
  let best: ColumnPick | null = null;
  for (let colIdx = 0; colIdx < 2; colIdx++) {
    for (const nb of columnsBlock.columns[colIdx].blocks) {
      if (nb.id === id) {
        const next = { columnsBlock, columnIndex: colIdx as 0 | 1, block: nb, depth };
        if (!best || next.depth >= best.depth) best = next;
      }
      if (nb.type === "container") {
        for (const child of nb.children) {
          const inner = findBlockInColumnCellContext(child, columnsBlock, colIdx as 0 | 1, depth + 1, id);
          if (inner && (!best || inner.depth >= best.depth)) best = inner;
        }
      }
      if (nb.type === "columns") {
        const inner = findInnermostColumnSelection(nb, id, depth + 1);
        if (inner && (!best || inner.depth >= best.depth)) best = inner;
      }
    }
  }
  return best;
}

function findInStoryBlockFromChildren(children: StoryBlock[], id: string): StoryBlock | null {
  for (const c of children) {
    const h = findInStoryBlock(c, id);
    if (h) return h;
  }
  return null;
}

function findInStoryBlock(b: StoryBlock, id: string): StoryBlock | null {
  if (b.id === id) return b;
  if (b.type === "container") {
    return findInStoryBlockFromChildren(b.children, id);
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
        const h = findInColumnNested(nb, id);
        if (h) return h as StoryBlock;
      }
    }
  }
  return null;
}

function findInColumnNested(nb: StoryColumnNestedBlock, id: string): StoryColumnNestedBlock | null {
  if (nb.id === id) return nb;
  if (nb.type === "splitContent") {
    if (nb.text.id === id) return nb.text as StoryColumnNestedBlock;
    for (const sb of nb.supporting.blocks) {
      const h = findInStoryBlock(sb as StoryBlock, id);
      if (h) return h as StoryColumnNestedBlock;
    }
    return null;
  }
  if (nb.type === "container") {
    for (const c of nb.children) {
      const h = findInStoryBlock(c, id);
      if (h) return h as StoryColumnNestedBlock;
    }
  }
  if (nb.type === "columns") {
    for (const slot of nb.columns) {
      for (const inner of slot.blocks) {
        const h = findInColumnNested(inner, id);
        if (h) return h;
      }
    }
  }
  return null;
}

export function resolveStorySelection(section: StorySection, id: string | null): StorySelection | null {
  if (!id) return null;
  for (const b of section.blocks) {
    if (b.id === id) return { mode: "section", block: b };
  }
  for (const b of section.blocks) {
    if (b.type === "container") {
      const inner = findInStoryBlockFromChildren(b.children, id);
      if (inner) return { mode: "section", block: inner };
    }
  }
  for (const b of section.blocks) {
    if (b.type === "columns") {
      const hit = findInnermostColumnSelection(b, id, 1);
      if (hit) {
        const { depth: _d, ...rest } = hit;
        return { mode: "column", ...rest };
      }
    }
  }
  return null;
}
