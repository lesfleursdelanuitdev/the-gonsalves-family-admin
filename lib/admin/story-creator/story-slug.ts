/** URL-safe slug from a story title (lowercase, ASCII hyphens). */
export function slugifyStoryTitle(title: string): string {
  const t = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
  return t.length > 0 ? t : "story";
}

/** Normalize user-edited slug input to stored form (empty → ""). */
export function normalizeStorySlugInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}
