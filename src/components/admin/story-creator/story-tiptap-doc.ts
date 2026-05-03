import type { JSONContent } from "@tiptap/core";

/** Valid TipTap / HTML heading levels for story rich-text blocks. */
export type StoryRichTextHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export function clampStoryRichTextHeadingLevel(n: number | undefined): StoryRichTextHeadingLevel {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 2;
  return Math.min(6, Math.max(1, v)) as StoryRichTextHeadingLevel;
}

/**
 * Align TipTap JSON with the block's semantic `headingLevel`: every `heading` node gets `attrs.level`,
 * and if the doc has no heading yet, the first top-level `paragraph` becomes a heading (heading preset).
 */
export function applyHeadingLevelToRichTextDoc(doc: JSONContent, level: StoryRichTextHeadingLevel): JSONContent {
  const clone = JSON.parse(JSON.stringify(doc)) as JSONContent;
  let foundHeading = false;

  function visit(node: JSONContent | undefined): void {
    if (!node || typeof node !== "object") return;
    if (node.type === "heading") {
      foundHeading = true;
      const prev = (node.attrs && typeof node.attrs === "object" ? node.attrs : {}) as Record<string, unknown>;
      node.attrs = { ...prev, level };
    }
    const c = node.content;
    if (Array.isArray(c)) {
      for (const child of c) visit(child);
    }
  }

  visit(clone);

  if (!foundHeading && clone.type === "doc" && Array.isArray(clone.content)) {
    const idx = clone.content.findIndex((n) => n && typeof n === "object" && n.type === "paragraph");
    if (idx >= 0) {
      const p = clone.content[idx] as JSONContent;
      clone.content[idx] = {
        type: "heading",
        attrs: { level },
        content: Array.isArray(p.content) && p.content.length > 0 ? p.content : [{ type: "text", text: "" }],
      };
    } else if (clone.content.length === 0) {
      clone.content = [
        {
          type: "heading",
          attrs: { level },
          content: [{ type: "text", text: "" }],
        },
      ];
    }
  }

  return clone;
}

/** First `heading` node in document order (pre-order), if any. */
export function inferFirstHeadingLevel(doc: JSONContent | undefined): StoryRichTextHeadingLevel | undefined {
  let found: StoryRichTextHeadingLevel | undefined;

  function visit(node: JSONContent | undefined): void {
    if (found !== undefined || !node || typeof node !== "object") return;
    if (node.type === "heading") {
      const L = (node.attrs as { level?: number } | undefined)?.level;
      if (typeof L === "number") found = clampStoryRichTextHeadingLevel(L);
      return;
    }
    const c = node.content;
    if (Array.isArray(c)) {
      for (const ch of c) visit(ch);
    }
  }

  visit(doc);
  return found;
}

/** Empty TipTap document for a new rich-text story block. */
export const EMPTY_STORY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Coerce persisted JSON into a valid TipTap doc for `setContent` / `useEditor`. */
export function normalizeStoryDocContent(input: unknown): JSONContent {
  if (!isRecord(input) || input.type !== "doc") {
    return { ...EMPTY_STORY_DOC, content: [...(EMPTY_STORY_DOC.content ?? [])] };
  }
  const content = input.content;
  if (!Array.isArray(content) || content.length === 0) {
    return { ...EMPTY_STORY_DOC, content: [...(EMPTY_STORY_DOC.content ?? [])] };
  }
  return input as JSONContent;
}

export function storyDocJsonEquals(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export type StoryRichTextListVariant = "bullet" | "ordered";

function deepCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Starter doc for Add Block → List (one empty list item). */
export function emptyListStarterDoc(variant: StoryRichTextListVariant = "bullet"): JSONContent {
  const listType = variant === "bullet" ? "bulletList" : "orderedList";
  return {
    type: "doc",
    content: [
      {
        type: listType,
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph" }],
          },
        ],
      },
    ],
  };
}

/** True when `doc` matches {@link emptyListStarterDoc} for the given variant (used for auto-focus). */
export function isEmptyListStarterDoc(doc: unknown, variant: StoryRichTextListVariant = "bullet"): boolean {
  if (!isRecord(doc) || doc.type !== "doc" || !Array.isArray(doc.content) || doc.content.length !== 1) return false;
  return storyDocJsonEquals(doc, emptyListStarterDoc(variant));
}

/** Doc already has a top-level bullet or ordered list — do not replace when converting to list preset. */
export function storyRichTextDocHasTopLevelList(doc: JSONContent | undefined): boolean {
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) return false;
  return doc.content.some((n) => n && typeof n === "object" && (n.type === "bulletList" || n.type === "orderedList"));
}

function collectParagraphLikeNodes(node: JSONContent | undefined, sink: JSONContent[]): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "paragraph" || node.type === "heading") {
    sink.push(node);
    return;
  }
  const c = node.content;
  if (Array.isArray(c)) {
    for (const ch of c) collectParagraphLikeNodes(ch as JSONContent, sink);
  }
}

function listItemFromParagraphLike(node: JSONContent): JSONContent {
  const para: JSONContent =
    node.type === "paragraph"
      ? {
          type: "paragraph",
          ...(Array.isArray(node.content) && node.content.length > 0 ? { content: deepCloneJson(node.content) } : {}),
        }
      : node.type === "heading"
        ? {
            type: "paragraph",
            ...(Array.isArray(node.content) && node.content.length > 0 ? { content: deepCloneJson(node.content) } : {}),
          }
        : { type: "paragraph" };

  return { type: "listItem", content: [para] };
}

/**
 * Build a real TipTap list doc from non-list content: each top-level paragraph/heading becomes one list item.
 * Blockquotes are flattened to their inner paragraphs. If the doc already has a top-level list, returns a deep clone unchanged.
 */
export function transformRichTextDocToList(doc: JSONContent, variant: StoryRichTextListVariant): JSONContent {
  const clone = deepCloneJson(doc);
  if (!clone || clone.type !== "doc") return emptyListStarterDoc(variant);
  if (!Array.isArray(clone.content)) clone.content = [];

  if (storyRichTextDocHasTopLevelList(clone)) {
    return clone;
  }

  const paragraphs: JSONContent[] = [];
  for (const child of clone.content) {
    if (!child || typeof child !== "object" || !child.type) continue;
    if (child.type === "paragraph" || child.type === "heading") {
      paragraphs.push(child as JSONContent);
    } else if (child.type === "blockquote") {
      collectParagraphLikeNodes(child as JSONContent, paragraphs);
    }
  }

  const listItems =
    paragraphs.length > 0 ? paragraphs.map((p) => listItemFromParagraphLike(p)) : [{ type: "listItem", content: [{ type: "paragraph" }] }];

  const listType = variant === "bullet" ? "bulletList" : "orderedList";
  return { type: "doc", content: [{ type: listType, content: listItems }] };
}

/** Swap top-level `bulletList` / `orderedList` wrapper type; preserves list item bodies. */
export function swapListVariantInDoc(doc: JSONContent, variant: StoryRichTextListVariant): JSONContent {
  const clone = deepCloneJson(doc);
  if (!clone || clone.type !== "doc" || !Array.isArray(clone.content)) return emptyListStarterDoc(variant);
  const nextList = variant === "bullet" ? "bulletList" : "orderedList";
  clone.content = clone.content.map((node) => {
    if (!node || typeof node !== "object") return node as JSONContent;
    if (node.type === "bulletList" || node.type === "orderedList") {
      return { ...node, type: nextList } as JSONContent;
    }
    return node as JSONContent;
  });
  return clone;
}

/** Turn list blocks at the top level back into loose paragraphs (used when leaving list preset). */
export function unwrapListItemsToParagraphDoc(doc: JSONContent): JSONContent {
  const clone = deepCloneJson(doc);
  if (!clone || clone.type !== "doc" || !Array.isArray(clone.content)) {
    return { ...EMPTY_STORY_DOC, content: [...(EMPTY_STORY_DOC.content ?? [])] };
  }
  const out: JSONContent[] = [];
  for (const node of clone.content) {
    if (!node || typeof node !== "object") continue;
    if (node.type === "bulletList" || node.type === "orderedList") {
      const items = Array.isArray(node.content) ? node.content : [];
      for (const li of items) {
        if (!li || typeof li !== "object" || li.type !== "listItem" || !Array.isArray(li.content)) continue;
        for (const inner of li.content) {
          out.push(deepCloneJson(inner as JSONContent));
        }
      }
    } else {
      out.push(deepCloneJson(node as JSONContent));
    }
  }
  if (out.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return { type: "doc", content: out };
}
