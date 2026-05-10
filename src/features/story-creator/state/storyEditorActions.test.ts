import { describe, expect, it } from "vitest";
import type { StoryBlock, StoryDocument, StorySection } from "@/lib/admin/story-creator/story-types";
import {
  addBlockInDocument,
  chooseDefaultSectionId,
  deleteBlockInDocument,
  deleteSectionInDocument,
  duplicateBlockInDocument,
  moveBlockInDocument,
  normalizeDocumentForStore,
} from "@/features/story-creator/state/storyEditorActions";

function richTextBlock(id: string): StoryBlock {
  return {
    id,
    type: "richText",
    doc: { type: "doc", content: [{ type: "paragraph" }] },
  };
}

function containerBlock(id: string, children: StoryBlock[]): StoryBlock {
  return {
    id,
    type: "container",
    props: {},
    children,
  };
}

function section(id: string, blocks: StoryBlock[], children: StorySection[] = []): StorySection {
  return { id, title: id, blocks, children };
}

function documentWithSections(sections: StorySection[]): StoryDocument {
  return {
    version: 1,
    id: "doc-1",
    title: "Story",
    status: "draft",
    sections,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("normalizeDocumentForStore", () => {
  it("does not throw and returns an array when sections are missing", () => {
    const invalidDoc = {
      version: 1,
      id: "doc-x",
      title: "Invalid",
      status: "draft",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as unknown as StoryDocument;

    expect(() => normalizeDocumentForStore(invalidDoc)).not.toThrow();
    const normalized = normalizeDocumentForStore(invalidDoc);
    expect(Array.isArray(normalized.sections)).toBe(true);
    expect(normalized.sections).toEqual([]);
  });
});

describe("deleteBlockInDocument", () => {
  it("removes a top-level block and returns next selection", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("b"), richTextBlock("c")])]);

    const out = deleteBlockInDocument(doc, "b");
    expect(out.document.sections[0]?.blocks.map((b) => b.id)).toEqual(["a", "c"]);
    expect(out.nextSelectedId).toBe("c");
  });

  it("removes a nested container child and returns next nested selection", () => {
    const doc = documentWithSections([
      section("s1", [containerBlock("container-1", [richTextBlock("x"), richTextBlock("y")]), richTextBlock("tail")]),
    ]);

    const out = deleteBlockInDocument(doc, "x");
    const container = out.document.sections[0]?.blocks[0];
    expect(container?.type).toBe("container");
    if (container?.type === "container") {
      expect(container.children.map((b) => b.id)).toEqual(["y"]);
    }
    expect(out.nextSelectedId).toBe("y");
  });

  it("is a no-op when block id does not exist", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a")])]);
    const out = deleteBlockInDocument(doc, "missing");
    expect(out.document).toBe(doc);
    expect(out.nextSelectedId).toBeNull();
  });
});

describe("duplicateBlockInDocument", () => {
  it("duplicates directly below original with a new id", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("b")])]);
    const out = duplicateBlockInDocument(doc, "a");
    const ids = out.document.sections[0]?.blocks.map((b) => b.id) ?? [];

    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("a");
    expect(ids[1]).toBe(out.duplicateId);
    expect(out.duplicateId).not.toBe("a");
  });
});

describe("moveBlockInDocument (direction)", () => {
  it("moves blocks up and down", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("b"), richTextBlock("c")])]);
    const movedDown = moveBlockInDocument(doc, "b", { kind: "direction", direction: 1 });
    expect(movedDown.sections[0]?.blocks.map((b) => b.id)).toEqual(["a", "c", "b"]);

    const movedUp = moveBlockInDocument(doc, "b", { kind: "direction", direction: -1 });
    expect(movedUp.sections[0]?.blocks.map((b) => b.id)).toEqual(["b", "a", "c"]);
  });

  it("is a no-op at boundaries", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("b")])]);
    expect(moveBlockInDocument(doc, "a", { kind: "direction", direction: -1 })).toBe(doc);
    expect(moveBlockInDocument(doc, "b", { kind: "direction", direction: 1 })).toBe(doc);
  });
});

describe("moveBlockInDocument (relative)", () => {
  it("inserts moved block below target", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("b"), richTextBlock("c")])]);
    const moved = moveBlockInDocument(doc, "a", { kind: "relative", targetBlockId: "c", position: "below" });
    expect(moved.sections[0]?.blocks.map((b) => b.id)).toEqual(["b", "c", "a"]);
  });

  it("inserts moved block above target", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("b"), richTextBlock("c")])]);
    const moved = moveBlockInDocument(doc, "c", { kind: "relative", targetBlockId: "a", position: "above" });
    expect(moved.sections[0]?.blocks.map((b) => b.id)).toEqual(["c", "a", "b"]);
  });
});

describe("addBlockInDocument", () => {
  it("inserts at index", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("c")])]);
    const out = addBlockInDocument(doc, "s1", richTextBlock("b"), { kind: "index", index: 1 });
    expect(out.sections[0]?.blocks.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("inserts relative to target", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a"), richTextBlock("c")])]);
    const out = addBlockInDocument(doc, "ignored", richTextBlock("b"), {
      kind: "relative",
      targetBlockId: "a",
      position: "below",
    });
    expect(out.sections[0]?.blocks.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("appends into container", () => {
    const doc = documentWithSections([
      section("s1", [containerBlock("container-1", [richTextBlock("a")]), richTextBlock("tail")]),
    ]);
    const out = addBlockInDocument(doc, "container-1", richTextBlock("b"), { kind: "append-into-container" });
    const first = out.sections[0]?.blocks[0];
    expect(first?.type).toBe("container");
    if (first?.type === "container") {
      expect(first.children.map((b) => b.id)).toEqual(["a", "b"]);
    }
  });
});

describe("deleteSectionInDocument", () => {
  it("removes a section by id", () => {
    const doc = documentWithSections([section("s1", [richTextBlock("a")]), section("s2", [richTextBlock("b")])]);
    const out = deleteSectionInDocument(doc, "s1");
    expect(out.sections.map((s) => s.id)).toEqual(["s2"]);
  });

  it("removes nested child sections with parent", () => {
    const doc = documentWithSections([
      section("parent", [richTextBlock("a")], [section("child-1", [richTextBlock("b")])]),
      section("s2", [richTextBlock("c")]),
    ]);
    const out = deleteSectionInDocument(doc, "parent");
    expect(out.sections.map((s) => s.id)).toEqual(["s2"]);
  });
});

describe("chooseDefaultSectionId", () => {
  it("returns first section id", () => {
    const doc = documentWithSections([section("first", [richTextBlock("a")]), section("second", [richTextBlock("b")])]);
    expect(chooseDefaultSectionId(doc)).toBe("first");
  });

  it("returns null on empty document", () => {
    const doc = documentWithSections([]);
    expect(chooseDefaultSectionId(doc)).toBeNull();
  });
});

