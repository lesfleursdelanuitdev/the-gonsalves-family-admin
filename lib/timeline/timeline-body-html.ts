import DOMPurify from "isomorphic-dompurify";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeHref(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("https://") || t.startsWith("http://")) return t;
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  return "#";
}

/**
 * Turn `[label](url)` segments into links; escape everything else. Output is safe HTML for `dangerouslySetInnerHTML`.
 */
export function timelineBodyToSafeHtml(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  const withLinks = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    const safeHref = sanitizeHref(href);
    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  });
  return DOMPurify.sanitize(withLinks, {
    ALLOWED_TAGS: ["a", "br", "strong", "em", "b", "i", "p"],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
  });
}
