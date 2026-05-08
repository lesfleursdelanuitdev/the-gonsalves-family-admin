import { storyBlockDisplayLabel } from "@/lib/admin/story-creator/story-block-presets";
import type { StoryBlock, StoryColumnNestedBlock } from "@/lib/admin/story-creator/story-types";

/** One selectable row in the story structure outline (includes nested blocks). */
export type StoryOutlineBlockRow = {
  id: string;
  label: string;
  /** 0 = top-level block in the section; increases inside containers, columns, split layout. */
  depth: number;
};

type WalkableBlock = StoryBlock | StoryColumnNestedBlock;

function blockLabel(block: WalkableBlock): string {
  return storyBlockDisplayLabel(block as StoryBlock);
}

/**
 * Depth-first walk: emit each block, then nested blocks inside containers, both column slots,
 * and split content (primary rich text + supporting rail).
 */
function walkBlock(block: WalkableBlock, depth: number, prefix: string, out: StoryOutlineBlockRow[]): void {
  const label = prefix ? `${prefix}${blockLabel(block)}` : blockLabel(block);
  out.push({ id: block.id, label, depth });

  switch (block.type) {
    case "container": {
      for (const ch of block.children ?? []) {
        walkBlock(ch, depth + 1, "", out);
      }
      break;
    }
    case "columns": {
      const [c0, c1] = block.columns;
      for (const ch of c0?.blocks ?? []) {
        walkBlock(ch, depth + 1, "Column 1 · ", out);
      }
      for (const ch of c1?.blocks ?? []) {
        walkBlock(ch, depth + 1, "Column 2 · ", out);
      }
      break;
    }
    case "splitContent": {
      walkBlock(block.text, depth + 1, "Main · ", out);
      for (const ch of block.supporting.blocks ?? []) {
        walkBlock(ch as StoryColumnNestedBlock, depth + 1, "Sidebar · ", out);
      }
      break;
    }
    default:
      break;
  }
}

/** Flat outline rows for all blocks in a section, including nesting. */
export function flattenSectionBlocksForOutline(blocks: StoryBlock[]): StoryOutlineBlockRow[] {
  const out: StoryOutlineBlockRow[] = [];
  for (const b of blocks) {
    walkBlock(b, 0, "", out);
  }
  return out;
}
