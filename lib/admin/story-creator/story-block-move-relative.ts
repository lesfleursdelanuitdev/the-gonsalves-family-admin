import type { StoryBlock, StoryColumnSlot, StoryColumnsBlock, StorySection } from "@/lib/admin/story-creator/story-types";

function moveInStoryBlockChildren(
  children: StoryBlock[],
  blockId: string,
  dir: -1 | 1,
): { next: StoryBlock[]; changed: boolean } {
  const ix = children.findIndex((c) => c.id === blockId);
  if (ix >= 0) {
    const j = ix + dir;
    if (j < 0 || j >= children.length) return { next: children, changed: false };
    const next = [...children];
    const a = next[ix]!;
    const b = next[j]!;
    next[ix] = b;
    next[j] = a;
    return { next, changed: true };
  }
  let changed = false;
  const next = children.map((c) => {
    if (c.type === "container") {
      const r = moveInStoryBlockChildren(c.children, blockId, dir);
      if (r.changed) {
        changed = true;
        return { ...c, children: r.next };
      }
      return c;
    }
    if (c.type === "columns") {
      const r = moveInColumnsBlock(c, blockId, dir);
      if (r.changed) {
        changed = true;
        return r.next;
      }
      return c;
    }
    return c;
  });
  return { next: changed ? next : children, changed };
}

function moveInColumnsBlock(
  block: StoryColumnsBlock,
  blockId: string,
  dir: -1 | 1,
): { next: StoryColumnsBlock; changed: boolean } {
  for (let col = 0; col < 2; col++) {
    const slot = block.columns[col];
    const ix = slot.blocks.findIndex((nb) => nb.id === blockId);
    if (ix >= 0) {
      const j = ix + dir;
      if (j < 0 || j >= slot.blocks.length) return { next: block, changed: false };
      const nb = [...slot.blocks];
      const a = nb[ix]!;
      const b = nb[j]!;
      nb[ix] = b;
      nb[j] = a;
      const cols: [StoryColumnSlot, StoryColumnSlot] = [...block.columns];
      cols[col] = { ...slot, blocks: nb };
      return { next: { ...block, columns: cols }, changed: true };
    }
  }
  for (let col = 0; col < 2; col++) {
    const slot = block.columns[col];
    let slotChanged = false;
    const nextBlocks = slot.blocks.map((nb) => {
      if (nb.type === "container") {
        const r = moveInStoryBlockChildren(nb.children, blockId, dir);
        if (r.changed) {
          slotChanged = true;
          return { ...nb, children: r.next };
        }
        return nb;
      }
      if (nb.type === "columns") {
        const r = moveInColumnsBlock(nb, blockId, dir);
        if (r.changed) {
          slotChanged = true;
          return r.next;
        }
        return nb;
      }
      return nb;
    });
    if (slotChanged) {
      const cols: [StoryColumnSlot, StoryColumnSlot] = [...block.columns];
      cols[col] = { ...slot, blocks: nextBlocks };
      return { next: { ...block, columns: cols }, changed: true };
    }
  }
  return { next: block, changed: false };
}

/** Swap this block with its sibling in document order (section, container children, or column slots). No-op at boundaries. */
export function moveStoryBlockRelative(sec: StorySection, blockId: string, direction: -1 | 1): StorySection {
  const topIdx = sec.blocks.findIndex((b) => b.id === blockId);
  if (topIdx >= 0) {
    const j = topIdx + direction;
    if (j < 0 || j >= sec.blocks.length) return sec;
    const blocks = [...sec.blocks];
    const a = blocks[topIdx]!;
    const b = blocks[j]!;
    blocks[topIdx] = b;
    blocks[j] = a;
    return { ...sec, blocks };
  }
  const r = moveInStoryBlockChildren(sec.blocks, blockId, direction);
  return r.changed ? { ...sec, blocks: r.next } : sec;
}
