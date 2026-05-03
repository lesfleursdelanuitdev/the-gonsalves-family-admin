import type { Editor } from "@tiptap/core";
import type { StoryFieldKey } from "@/lib/admin/story-creator/story-field-resolve";

export const STORY_FONT_SIZE_BASE_PX = 15;
export const STORY_FONT_SIZE_STEP = 2;
export const STORY_FONT_SIZE_MIN = 10;
export const STORY_FONT_SIZE_MAX = 56;

/** Alignment for the nearest paragraph or heading (list items use inner paragraphs). */
export function blockTextAlign(editor: Editor): "left" | "center" | "right" | "justify" {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "paragraph" || node.type.name === "heading") {
      const ta = node.attrs.textAlign as string | undefined | null;
      if (ta === "center" || ta === "right" || ta === "justify" || ta === "left") return ta;
      return "left";
    }
  }
  return "left";
}

export function insertStoryField(editor: Editor, field: StoryFieldKey) {
  editor.chain().focus().insertContent({ type: "storyField", attrs: { field } }).run();
}

export function validateStoryLinkUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (t.startsWith("/") || t.startsWith("#") || t.startsWith("./") || t.startsWith("../")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:";
  } catch {
    return false;
  }
}

export function parseFontSizePx(raw: unknown): number | null {
  if (raw == null || typeof raw !== "string") return null;
  const m = /^([\d.]+)\s*px\s*$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function adjustStoryFontSize(editor: Editor, deltaPx: number) {
  const cur = parseFontSizePx(editor.getAttributes("textStyle").fontSize);
  const base = cur ?? STORY_FONT_SIZE_BASE_PX;
  const next = Math.min(STORY_FONT_SIZE_MAX, Math.max(STORY_FONT_SIZE_MIN, base + deltaPx));
  editor.chain().focus().setFontSize(`${next}px`).run();
}
