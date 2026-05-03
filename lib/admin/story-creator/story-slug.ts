/** Unicode dash / minus characters → ASCII hyphen for URL slugs. */
const UNICODE_DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

function mapUnicodeDashesToHyphen(s: string): string {
  return s.replace(UNICODE_DASHES, "-");
}

/**
 * Slug rules while typing: lowercase, spaces → hyphens, strip disallowed chars, collapse runs of hyphens.
 * Does **not** trim leading/trailing hyphens so users can type `the-journey-of-a-t` normally.
 */
export function normalizeStorySlugInputLive(raw: string): string {
  return mapUnicodeDashesToHyphen(raw)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 200);
}

/** URL-safe slug from a story title (lowercase, ASCII hyphens). */
export function slugifyStoryTitle(title: string): string {
  const base = mapUnicodeDashesToHyphen(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const t = normalizeStorySlugInput(base);
  return t.length > 0 ? t : "story";
}

/** Final / persisted slug: trim edges, normalize unicode dashes, collapse hyphens, trim leading/trailing `-`. */
export function normalizeStorySlugInput(raw: string): string {
  return normalizeStorySlugInputLive(raw.trim())
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 200);
}
