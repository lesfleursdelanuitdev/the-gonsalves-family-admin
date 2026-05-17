import DOMPurify from "isomorphic-dompurify";

type PurifyConfig = NonNullable<Parameters<typeof DOMPurify.sanitize>[1]>;

const STORY_CAPTION_PURIFY_HTML: PurifyConfig = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "mark", "a", "span"],
  ALLOWED_ATTR: ["href", "target", "rel", "style", "class", "data-entity-type", "data-entity-id", "data-entity-xref"],
  ALLOW_DATA_ATTR: true,
};

function normalizeCaptionInput(input: string | null | undefined): string {
  return String(input ?? "").replace(/\0/g, "").trim();
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function looksLikeHtml(raw: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(raw);
}

export function sanitizeStoryCaptionHtml(html: string): string {
  return DOMPurify.sanitize(html, STORY_CAPTION_PURIFY_HTML).trim();
}

export function storyCaptionHtmlIsEmpty(html: string): boolean {
  const textOnly = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return textOnly.length === 0;
}

/**
 * Backwards-compatible: plain text captions are wrapped into paragraph HTML so older data still edits/renders.
 */
export function storyCaptionToEditorHtml(caption: string | null | undefined): string {
  const normalized = normalizeCaptionInput(caption);
  if (!normalized) return "<p></p>";
  if (looksLikeHtml(normalized)) {
    const clean = sanitizeStoryCaptionHtml(normalized);
    return clean || "<p></p>";
  }
  const wrapped = `<p>${escapeHtml(normalized).replace(/\r?\n/g, "<br>")}</p>`;
  const clean = sanitizeStoryCaptionHtml(wrapped);
  return clean || "<p></p>";
}

/**
 * Stores caption as sanitized HTML. Returns `undefined` when no readable content remains.
 */
export function storyCaptionFromEditorHtml(html: string): string | undefined {
  const clean = sanitizeStoryCaptionHtml(html ?? "");
  if (!clean || storyCaptionHtmlIsEmpty(clean)) return undefined;
  return clean;
}

export function storyCaptionToRenderableHtml(caption: string | null | undefined): string | null {
  const html = storyCaptionToEditorHtml(caption);
  return storyCaptionHtmlIsEmpty(html) ? null : html;
}
