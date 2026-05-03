import type { StoryBlock, StoryColumnNestedBlock, StorySection } from "@/lib/admin/story-creator/story-types";

/** Top-level section columns = 1; one level inside a column = 2. */
export const MAX_STORY_COLUMNS_NEST_DEPTH = 2;

/**
 * Depth of a columns block in the section tree (1 = directly under the section).
 * Returns null if the id is not a columns block in this section.
 */
export function columnsBlockDepthInSection(section: StorySection, columnsBlockId: string): number | null {
  return findColumnsDepth(section.blocks, columnsBlockId, 0);
}

function findColumnsDepth(
  blocks: readonly (StoryBlock | StoryColumnNestedBlock)[],
  columnsBlockId: string,
  parentColumnsDepth: number,
): number | null {
  for (const b of blocks) {
    if (b.type === "container") {
      const inner = findColumnsDepth(b.children, columnsBlockId, parentColumnsDepth);
      if (inner != null) return inner;
      continue;
    }
    if (b.type === "splitContent") {
      const inner = findColumnsDepth(b.supporting.blocks as readonly StoryColumnNestedBlock[], columnsBlockId, parentColumnsDepth);
      if (inner != null) return inner;
      continue;
    }
    if (b.type !== "columns") continue;
    const depth = parentColumnsDepth + 1;
    if (b.id === columnsBlockId) return depth;
    for (const slot of b.columns) {
      const inner = findColumnsDepth(slot.blocks, columnsBlockId, depth);
      if (inner != null) return inner;
    }
  }
  return null;
}

/** True if a new columns block may be inserted inside this columns block's cell. */
export function canInsertNestedColumnsAtDepth(parentColumnsDepth: number): boolean {
  return parentColumnsDepth < MAX_STORY_COLUMNS_NEST_DEPTH;
}
