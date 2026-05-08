/**
 * Note bodies are stored as Markdown. We normalize via HTML (marked → DOMPurify → Turndown)
 * so dangerous markup / scripts never persist, and the editor round-trips safely.
 */
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import TurndownService from "turndown";

/** Hard cap for DB / memory; trimmed before parse. */
export const NOTE_CONTENT_MAX_CHARS = 500_000;

marked.setOptions({ gfm: true, breaks: false });

type PurifyConfig = NonNullable<Parameters<typeof DOMPurify.sanitize>[1]>;

const PURIFY_HTML: PurifyConfig = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "code",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "a",
    "span",
  ],
  ALLOWED_ATTR: ["href", "title", "class", "target", "rel"],
  ALLOW_DATA_ATTR: false,
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export function isSafeNoteLinkHref(url: string): boolean {
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

/** Markdown → sanitized HTML for Tiptap `setContent` / initial document. */
export function markdownToSafeHtml(markdown: string): string {
  const md = (markdown ?? "").trim();
  if (!md) return "<p></p>";
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, PURIFY_HTML);
}

/** Editor HTML → markdown for form state / API (sanitize first). */
export function safeHtmlToMarkdown(html: string): string {
  const clean = DOMPurify.sanitize(html ?? "", PURIFY_HTML);
  const md = turndown.turndown(clean).trim();
  return md;
}

/**
 * Call before Prisma write: strips NULs, enforces max length, and runs the HTML pipeline
 * so stored markdown is normalized and safe.
 */
export function sanitizeNoteMarkdownForPersistence(input: string): string {
  let s = String(input ?? "").replace(/\0/g, "");
  if (s.length > NOTE_CONTENT_MAX_CHARS) {
    s = s.slice(0, NOTE_CONTENT_MAX_CHARS);
  }
  try {
    return safeHtmlToMarkdown(markdownToSafeHtml(s)).trimEnd();
  } catch {
    return s.trim();
  }
}

/** Light cleanup before ReactMarkdown (rehype-sanitize still runs at render). */
export function prepareNoteMarkdownForRender(input: string): string {
  return String(input ?? "").replace(/\0/g, "");
}
