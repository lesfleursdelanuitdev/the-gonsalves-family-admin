import type { JSONContent } from "@tiptap/core";

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
