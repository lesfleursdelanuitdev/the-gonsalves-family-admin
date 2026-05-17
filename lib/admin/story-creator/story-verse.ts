import type { JSONContent } from "@tiptap/core";
import type { StoryBlockRowAlignment, StoryRichTextBlock } from "@/lib/admin/story-creator/story-types";

export function verseTextFromTipTapDoc(doc: unknown): string {
  const paragraphs: string[] = [];
  const collectText = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const record = node as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof record.text === "string") return record.text;
    if (!Array.isArray(record.content)) return "";
    const inner = record.content.map(collectText).join("");
    return record.type === "paragraph" || record.type === "heading" ? `${inner}\n` : inner;
  };

  if (doc && typeof doc === "object" && Array.isArray((doc as { content?: unknown }).content)) {
    for (const child of (doc as { content: unknown[] }).content) {
      const text = collectText(child);
      paragraphs.push(text.endsWith("\n") ? text.slice(0, -1) : text);
    }
  }

  return paragraphs.join("\n").trimEnd();
}

export function verseContentFromBlock(block: StoryRichTextBlock): string {
  return block.verseContent ?? verseTextFromTipTapDoc(block.doc);
}

export function verseLineDocsFromTipTapDoc(doc: unknown): JSONContent[] {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as { content?: unknown }).content)) return [];
  return (doc as { content: JSONContent[] }).content.map((node) => ({
    type: "doc",
    content: [node],
  }));
}

export function verseTitleFromBlock(block: StoryRichTextBlock): string {
  return block.verseTitle ?? "";
}

export function verseContentToTipTapDoc(content: string): JSONContent {
  const lines = content.split(/\r?\n/);
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

export function storyTextAlignClass(align: StoryBlockRowAlignment | undefined): string {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right";
  return "text-center";
}

export function storyVerseStaggerStyle(
  align: StoryBlockRowAlignment | undefined,
  index: number,
): { marginLeft?: string; marginRight?: string; transform?: string } | undefined {
  const step = index % 4;
  const offset = step === 1 || step === 3 ? "1.25rem" : step === 2 ? "2.5rem" : "0rem";
  if (offset === "0rem") return undefined;
  if (align === "right") return { marginRight: offset };
  if (align === "center") return { transform: `translateX(${step === 1 ? "-" : ""}${offset})` };
  return { marginLeft: offset };
}
