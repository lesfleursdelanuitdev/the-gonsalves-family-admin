import type { JSONContent } from "@tiptap/core";
import type { StoryRichTextTextPreset } from "@/lib/admin/story-creator/story-types";

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

function isEmptyParagraphNode(node: JSONContent | undefined): boolean {
  return Boolean(node && node.type === "paragraph" && (!Array.isArray(node.content) || node.content.length === 0));
}

function singleCellTableContent(node: JSONContent | undefined): JSONContent[] | null {
  if (!node || node.type !== "table" || !Array.isArray(node.content) || node.content.length !== 1) return null;
  const row = node.content[0];
  if (!row || row.type !== "tableRow" || !Array.isArray(row.content) || row.content.length !== 1) return null;
  const cell = row.content[0];
  if (!cell || (cell.type !== "tableCell" && cell.type !== "tableHeader") || !Array.isArray(cell.content)) return null;
  return cell.content.length > 0 ? cell.content : [{ type: "paragraph" }];
}

/**
 * Some rich-text sources copy ordinary paragraphs inside a one-cell HTML table.
 * Paragraph story blocks should treat that wrapper as paste debris, not as an authored table.
 */
export function unwrapSingleCellTablesToParagraphContent(doc: JSONContent): JSONContent {
  const normalized = normalizeStoryDocContent(doc);
  if (!Array.isArray(normalized.content)) return normalized;

  let changed = false;
  const content: JSONContent[] = [];
  for (const node of normalized.content) {
    const unwrapped = singleCellTableContent(node as JSONContent);
    if (unwrapped) {
      changed = true;
      content.push(...deepCloneJson(unwrapped));
    } else {
      content.push(deepCloneJson(node as JSONContent));
    }
  }

  if (!changed) return normalized;
  while (content.length > 1 && isEmptyParagraphNode(content[content.length - 1])) {
    content.pop();
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
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

/** Recursively turn `heading` nodes into `paragraph` (same inline content). */
export function convertHeadingsToParagraphsInDoc(doc: JSONContent): JSONContent {
  function visit(n: JSONContent): JSONContent {
    if (!n || typeof n !== "object") return n;
    if (n.type === "heading") {
      const inner = Array.isArray(n.content) ? n.content.map(visit) : [];
      return {
        type: "paragraph",
        content: inner.length > 0 ? inner : [{ type: "text", text: "" }],
      };
    }
    const c = n.content;
    if (Array.isArray(c)) {
      return { ...n, content: c.map(visit) } as JSONContent;
    }
    return n;
  }
  return visit(deepCloneJson(doc));
}

/**
 * Align TipTap JSON with the block’s semantic `preset` (inspector / migration).
 * Quote and verse shapes are left unchanged except for normalization to a valid doc.
 */
export function syncRichTextDocToPreset(
  doc: JSONContent,
  preset: StoryRichTextTextPreset,
  opts?: { headingLevel?: StoryRichTextHeadingLevel; listVariant?: StoryRichTextListVariant },
): JSONContent {
  const normalized = normalizeStoryDocContent(doc);
  switch (preset) {
    case "paragraph":
      return convertHeadingsToParagraphsInDoc(unwrapSingleCellTablesToParagraphContent(unwrapListItemsToParagraphDoc(normalized)));
    case "heading": {
      const lvl = clampStoryRichTextHeadingLevel(opts?.headingLevel ?? inferFirstHeadingLevel(normalized) ?? 2);
      return applyHeadingLevelToRichTextDoc(normalized, lvl);
    }
    case "list": {
      const v = opts?.listVariant ?? "bullet";
      if (storyRichTextDocHasTopLevelList(normalized)) {
        return swapListVariantInDoc(normalized, v);
      }
      return transformRichTextDocToList(normalized, v);
    }
    case "quote":
    case "verse":
    default:
      return normalized;
  }
}
