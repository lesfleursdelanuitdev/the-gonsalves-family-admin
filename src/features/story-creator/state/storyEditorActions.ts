import {
  appendBlockIntoContainer,
  appendSupportingBlockToSplit,
  duplicateBlockRelativeToBlockId,
  findStoryBlockAnywhere,
  insertBlockAtIndex,
  insertBlockRelativeToBlockId,
  moveStoryBlockRelative,
  removeBlockById,
} from "@/lib/admin/story-creator/story-doc-mutators";
import {
  appendChildSection,
  firstSectionInOrder,
  insertSectionAfterSibling,
  mapSectionInDocument,
  moveSectionInDocument,
  normalizeRootSections,
  removeSectionFromTree,
} from "@/lib/admin/story-creator/story-section-tree";
import type { StoryBlock, StoryDocument, StorySection } from "@/lib/admin/story-creator/story-types";
import type { AddBlockPosition, AddSectionPosition, MoveBlockTarget } from "@/features/story-creator/state/storyEditorTypes";

export function normalizeDocumentForStore(doc: StoryDocument): StoryDocument {
  return {
    ...doc,
    sections: normalizeRootSections(Array.isArray(doc.sections) ? doc.sections : []),
  };
}

function replaceBlockInBlockList(blocks: StoryBlock[], blockId: string, nextBlock: StoryBlock): StoryBlock[] | null {
  const ix = blocks.findIndex((b) => b.id === blockId);
  if (ix >= 0) {
    const next = [...blocks];
    next[ix] = nextBlock;
    return next;
  }
  let changed = false;
  const next = blocks.map((b) => {
    if (b.type === "container") {
      const inner = replaceBlockInBlockList(b.children, blockId, nextBlock);
      if (inner) {
        changed = true;
        return { ...b, children: inner };
      }
    }
    if (b.type === "splitContent") {
      if (b.text.id === blockId && nextBlock.type === "richText") {
        changed = true;
        return { ...b, text: nextBlock };
      }
      const inner = replaceBlockInBlockList(b.supporting.blocks as StoryBlock[], blockId, nextBlock);
      if (inner) {
        changed = true;
        return { ...b, supporting: { ...b.supporting, blocks: inner as typeof b.supporting.blocks } };
      }
    }
    if (b.type === "columns") {
      const cols = [...b.columns] as [typeof b.columns[0], typeof b.columns[1]];
      let colChanged = false;
      for (let i = 0; i < 2; i += 1) {
        const slot = cols[i];
        const inner = replaceBlockInBlockList(slot.blocks as StoryBlock[], blockId, nextBlock);
        if (inner) {
          cols[i] = { ...slot, blocks: inner as typeof slot.blocks };
          colChanged = true;
        }
      }
      if (colChanged) {
        changed = true;
        return { ...b, columns: cols };
      }
    }
    return b;
  });
  return changed ? next : null;
}

export function replaceBlockInSection(section: StorySection, blockId: string, nextBlock: StoryBlock): StorySection {
  const nextBlocks = replaceBlockInBlockList(section.blocks, blockId, nextBlock);
  return nextBlocks ? { ...section, blocks: nextBlocks } : section;
}

export function updateBlockInSection(section: StorySection, blockId: string, patch: Partial<StoryBlock>): StorySection {
  const current = findStoryBlockAnywhere(section, blockId);
  if (!current) return section;
  return replaceBlockInSection(section, blockId, { ...current, ...patch } as StoryBlock);
}

export function deleteBlockInDocument(
  doc: StoryDocument,
  blockId: string,
): { document: StoryDocument; nextSelectedId: string | null } {
  let nextSelectedId: string | null = null;
  let changed = false;
  const sections = (doc.sections ?? []).map((sec) => {
    const out = removeBlockById(sec, blockId);
    if (!out) return sec;
    changed = true;
    nextSelectedId = out.nextSelectedId;
    return out.section;
  });
  return { document: changed ? { ...doc, sections } : doc, nextSelectedId };
}

export function duplicateBlockInDocument(
  doc: StoryDocument,
  blockId: string,
): { document: StoryDocument; duplicateId: string | null } {
  let duplicateId: string | null = null;
  let changed = false;
  const sections = (doc.sections ?? []).map((sec) => {
    const out = duplicateBlockRelativeToBlockId(sec, blockId, "below");
    if (!out) return sec;
    changed = true;
    duplicateId = out.duplicateId;
    return out.section;
  });
  return { document: changed ? { ...doc, sections } : doc, duplicateId };
}

export function moveBlockInDocument(doc: StoryDocument, blockId: string, target: MoveBlockTarget): StoryDocument {
  if (target.kind === "direction") {
    let changed = false;
    const sections = (doc.sections ?? []).map((sec) => {
      const moved = moveStoryBlockRelative(sec, blockId, target.direction);
      if (moved !== sec) changed = true;
      return moved;
    });
    return changed ? { ...doc, sections } : doc;
  }
  if (target.targetBlockId === blockId) return doc;
  let sourceBlock: StoryBlock | null = null;
  let without = doc;
  for (const sec of doc.sections ?? []) {
    const hit = findStoryBlockAnywhere(sec, blockId);
    if (!hit) continue;
    sourceBlock = hit;
    const removed = removeBlockById(sec, blockId);
    if (removed) {
      without = mapSectionInDocument(doc, sec.id, () => removed.section);
    }
    break;
  }
  if (!sourceBlock) return doc;
  let inserted = false;
  const sections = (without.sections ?? []).map((sec) => {
    const next = insertBlockRelativeToBlockId(sec, target.targetBlockId, target.position, sourceBlock as StoryBlock);
    if (next) inserted = true;
    return next ?? sec;
  });
  return inserted ? { ...without, sections } : doc;
}

export function addBlockInDocument(
  doc: StoryDocument,
  parentIdOrSectionId: string,
  block: StoryBlock,
  position: AddBlockPosition,
): StoryDocument {
  if (position.kind === "index") {
    return mapSectionInDocument(doc, parentIdOrSectionId, (sec) => insertBlockAtIndex(sec, position.index, block));
  }
  if (position.kind === "relative") {
    let changed = false;
    const sections = (doc.sections ?? []).map((sec) => {
      const next = insertBlockRelativeToBlockId(sec, position.targetBlockId, position.position, block);
      if (next) changed = true;
      return next ?? sec;
    });
    return changed ? { ...doc, sections } : doc;
  }
  if (position.kind === "append-into-container") {
    let changed = false;
    const sections = (doc.sections ?? []).map((sec) => {
      const next = appendBlockIntoContainer(sec, parentIdOrSectionId, block);
      if (next) changed = true;
      return next ?? sec;
    });
    return changed ? { ...doc, sections } : doc;
  }
  let changed = false;
  const sections = (doc.sections ?? []).map((sec) => {
    const next = appendSupportingBlockToSplit(sec, parentIdOrSectionId, block as never);
    if (next) changed = true;
    return next ?? sec;
  });
  return changed ? { ...doc, sections } : doc;
}

export function addSectionInDocument(doc: StoryDocument, section: StorySection, position: AddSectionPosition): StoryDocument {
  if (position.kind === "root-after") return insertSectionAfterSibling(doc, position.afterSectionId, section);
  return appendChildSection(doc, position.parentSectionId, section);
}

export function deleteSectionInDocument(doc: StoryDocument, sectionId: string): StoryDocument {
  const { next } = removeSectionFromTree(doc.sections ?? [], sectionId);
  return { ...doc, sections: next };
}

export function chooseDefaultSectionId(doc: StoryDocument): string | null {
  return firstSectionInOrder(doc.sections ?? [])?.id ?? null;
}

export function moveSectionInDoc(doc: StoryDocument, sectionId: string, newParentId: string | null, insertBeforeId: string | null): StoryDocument {
  return moveSectionInDocument(doc, sectionId, newParentId, insertBeforeId) ?? doc;
}

