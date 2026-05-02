import type { StoryBlock, StoryDocument, StorySection } from "@/lib/admin/story-creator/story-types";

/** Normalize optional `blocks` / `children` after loading from disk. */
export function normalizeStorySection(node: StorySection): StorySection {
  const blocks = Array.isArray(node.blocks) ? node.blocks : [];
  const children = node.children?.length ? node.children.map(normalizeStorySection) : undefined;
  return {
    ...node,
    blocks,
    children,
  };
}

export function normalizeRootSections(sections: StorySection[]): StorySection[] {
  return sections.map(normalizeStorySection);
}

export function findSectionById(sections: readonly StorySection[], id: string): StorySection | null {
  for (const s of sections) {
    if (s.id === id) return s;
    if (s.children?.length) {
      const hit = findSectionById(s.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export type SectionPath = {
  section: StorySection;
  /** Immediate parent section, or `null` when `section` is at the document root. */
  parent: StorySection | null;
  /** Root → immediate parent (excludes `section`). */
  breadcrumb: StorySection[];
};

export function findSectionPath(sections: readonly StorySection[] | null | undefined, id: string): SectionPath | null {
  if (!sections?.length) return null;
  function walk(list: readonly StorySection[], parents: StorySection[]): SectionPath | null {
    for (const s of list) {
      if (s.id === id) {
        return {
          section: s,
          parent: parents[parents.length - 1] ?? null,
          breadcrumb: parents,
        };
      }
      if (s.children?.length) {
        const hit = walk(s.children, [...parents, s]);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(sections, []);
}

/** `true` if `ancestorId` is on the path from root to `descendantId` (strict ancestor). */
export function sectionIsAncestorOf(
  sections: readonly StorySection[] | null | undefined,
  ancestorId: string,
  descendantId: string,
): boolean {
  if (!sections?.length) return false;
  if (ancestorId === descendantId) return false;
  const path = findSectionPath(sections, descendantId);
  if (!path) return false;
  return path.breadcrumb.some((a) => a.id === ancestorId);
}

export function mapSectionInDocument(doc: StoryDocument, sectionId: string, fn: (s: StorySection) => StorySection): StoryDocument {
  function mapList(list: StorySection[]): { next: StorySection[]; hit: boolean } {
    let hit = false;
    const next = list.map((node) => {
      if (node.id === sectionId) {
        hit = true;
        return fn(node);
      }
      if (node.children?.length) {
        const { next: ch, hit: chHit } = mapList(node.children);
        if (chHit) {
          hit = true;
          return { ...node, children: ch };
        }
      }
      return node;
    });
    return { next, hit };
  }
  const roots = doc.sections ?? [];
  const { next, hit } = mapList(roots);
  if (!hit) return doc;
  return { ...doc, sections: next };
}

export function removeSectionFromTree(sections: StorySection[], sectionId: string): { next: StorySection[]; removed: StorySection | null } {
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx >= 0) {
    const removed = sections[idx]!;
    return { next: [...sections.slice(0, idx), ...sections.slice(idx + 1)], removed };
  }
  let removed: StorySection | null = null;
  const next = sections.map((s) => {
    if (!s.children?.length) return s;
    const { next: chNext, removed: chRemoved } = removeSectionFromTree(s.children, sectionId);
    if (chRemoved) removed = chRemoved;
    if (chNext !== s.children) return { ...s, children: chNext.length ? chNext : undefined };
    return s;
  });
  return { next, removed };
}

export function insertSectionIntoParent(
  sections: StorySection[],
  parentId: string | null,
  insertBeforeId: string | null,
  node: StorySection,
): StorySection[] {
  if (parentId == null) {
    if (insertBeforeId == null) return [...sections, node];
    const i = sections.findIndex((s) => s.id === insertBeforeId);
    const at = i < 0 ? sections.length : i;
    const next = [...sections];
    next.splice(at, 0, node);
    return next;
  }
  return sections.map((s) => {
    if (s.id === parentId) {
      const list = s.children ?? [];
      if (insertBeforeId == null) {
        return { ...s, children: [...list, node] };
      }
      const i = list.findIndex((x) => x.id === insertBeforeId);
      const at = i < 0 ? list.length : i;
      const next = [...list];
      next.splice(at, 0, node);
      return { ...s, children: next };
    }
    if (s.children?.length) {
      const ch = insertSectionIntoParent(s.children, parentId, insertBeforeId, node);
      if (ch !== s.children) return { ...s, children: ch };
    }
    return s;
  });
}

/** Append at root, or insert as the next sibling after `afterSectionId` (same parent list). */
export function insertSectionAfterSibling(doc: StoryDocument, afterSectionId: string | null, node: StorySection): StoryDocument {
  const roots = doc.sections ?? [];
  if (afterSectionId == null) {
    return { ...doc, sections: [...roots, node] };
  }
  const path = findSectionPath(roots, afterSectionId);
  if (!path) return doc;
  const parentId = path.parent?.id ?? null;
  const list = parentId ? path.parent!.children! : roots;
  const idx = list.findIndex((s) => s.id === afterSectionId);
  const insertBeforeId = idx >= 0 && idx + 1 < list.length ? list[idx + 1]!.id : null;
  return { ...doc, sections: insertSectionIntoParent(roots, parentId, insertBeforeId, node) };
}

/** Append a new child section under `parentId`. */
export function appendChildSection(doc: StoryDocument, parentId: string, node: StorySection): StoryDocument {
  return { ...doc, sections: insertSectionIntoParent(doc.sections ?? [], parentId, null, node) };
}

/** Move a section to a new parent and sibling index. Returns updated document or `null` if invalid (e.g. would create cycle). */
export function moveSectionInDocument(
  doc: StoryDocument,
  draggedId: string,
  newParentId: string | null,
  insertBeforeId: string | null,
): StoryDocument | null {
  const roots = doc.sections ?? [];
  if (newParentId != null && sectionIsAncestorOf(roots, draggedId, newParentId)) return null;
  if (newParentId === draggedId) return null;
  const { next: without, removed } = removeSectionFromTree(roots, draggedId);
  if (!removed) return null;
  const nextSections = insertSectionIntoParent(without, newParentId, insertBeforeId, removed);
  return { ...doc, sections: nextSections };
}

/** First section in depth-first order (for default selection). */
export function firstSectionInOrder(sections: readonly StorySection[] | null | undefined): StorySection | null {
  if (!sections || sections.length === 0) return null;
  const s = sections[0]!;
  if (s.children?.length) {
    const inner = firstSectionInOrder(s.children);
    if (inner) return inner;
  }
  return s;
}

/** Count root sections (shallow). */
export function countRootSections(sections: readonly StorySection[]): number {
  return sections.length;
}

/** Depth-first pre-order: parent, then each subtree in `children` order. */
export function flattenSectionsDepthFirst(sections: readonly StorySection[] | null | undefined): StorySection[] {
  const out: StorySection[] = [];
  function walk(list: readonly StorySection[]) {
    for (const s of list) {
      out.push(s);
      if (s.children?.length) walk(s.children);
    }
  }
  if (sections?.length) walk(sections);
  return out;
}
