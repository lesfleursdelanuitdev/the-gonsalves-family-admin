import { formatStoryAuthorLines } from "@/lib/admin/story-creator/story-author-display";
import type { StoryDocument } from "@/lib/admin/story-creator/story-types";

/**
 * Persisted on TipTap `storyField` nodes (`attrs.field`). Conceptually maps to
 * `{{story.title}}`, `{{story.subtitle}}`, `{{story.author}}` without storing raw mustache in JSON.
 */
export type StoryFieldKey = "title" | "subtitle" | "author";

export const STORY_FIELD_KEYS: readonly StoryFieldKey[] = ["title", "subtitle", "author"] as const;

export function isStoryFieldKey(v: string): v is StoryFieldKey {
  return v === "title" || v === "subtitle" || v === "author";
}

/** Labels for insert menu and editor chips (not persisted). */
export const STORY_FIELD_INSERT_LABELS: Record<StoryFieldKey, string> = {
  title: "Page title",
  subtitle: "Page subtitle",
  author: "Author",
};

/** Plain text from current story settings (same sources as Story tab / preview header). */
export function resolveStoryField(field: StoryFieldKey, doc: StoryDocument): string {
  if (field === "title") return (doc.title ?? "").trim();
  if (field === "subtitle") return (doc.excerpt ?? "").trim();
  return formatStoryAuthorLines(doc).join(" · ");
}
