import { findSectionById, flattenSectionsDepthFirst } from "@/lib/admin/story-creator/story-section-tree";
import { findStoryBlockAnywhere } from "@/lib/admin/story-creator/story-doc-mutators";
import type { StoryBlock, StorySection } from "@/lib/admin/story-creator/story-types";
import type { StoryEditorState } from "@/features/story-creator/state/storyEditorTypes";

export function getSectionById(state: StoryEditorState, sectionId: string | null): StorySection | null {
  if (!state.document || !sectionId) return null;
  return findSectionById(state.document.sections ?? [], sectionId);
}

export function getBlockById(state: StoryEditorState, blockId: string | null): StoryBlock | null {
  if (!state.document || !blockId) return null;
  const flat = flattenSectionsDepthFirst(state.document.sections ?? []);
  for (const sec of flat) {
    const hit = findStoryBlockAnywhere(sec, blockId);
    if (hit) return hit;
  }
  return null;
}

export function getSelectedBlock(state: StoryEditorState): StoryBlock | null {
  return getBlockById(state, state.selectedBlockId);
}

export function getBlocksForSection(state: StoryEditorState, sectionId: string | null): StoryBlock[] {
  return getSectionById(state, sectionId)?.blocks ?? [];
}

export function getDocumentSummary(state: StoryEditorState): {
  sectionCount: number;
  blockCount: number;
  dirty: boolean;
  lastSavedAt: string | null;
} {
  const sections = flattenSectionsDepthFirst(state.document?.sections ?? []);
  return {
    sectionCount: sections.length,
    blockCount: sections.reduce((n, s) => n + (Array.isArray(s.blocks) ? s.blocks.length : 0), 0),
    dirty: state.dirty,
    lastSavedAt: state.lastSavedAt,
  };
}

