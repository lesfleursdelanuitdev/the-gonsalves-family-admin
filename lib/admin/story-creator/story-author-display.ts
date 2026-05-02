import type { StoryAuthorPrefixMode, StoryDocument } from "@/lib/admin/story-creator/story-types";

export const STORY_AUTHOR_PREFIX_OPTIONS: {
  value: StoryAuthorPrefixMode;
  label: string;
  /** Example with the name “Alex Rivera” */
  example: string;
}[] = [
  { value: "by", label: "By", example: "By Alex Rivera" },
  { value: "author_label", label: 'Author: ', example: "Author: Alex Rivera" },
  { value: "custom", label: "Custom", example: "e.g. Written by Alex Rivera" },
  { value: "none", label: "None", example: "Alex Rivera" },
];

export function effectiveStoryAuthorPrefixMode(mode: StoryAuthorPrefixMode | undefined): StoryAuthorPrefixMode {
  return mode ?? "by";
}

type AuthorLineFields = Pick<StoryDocument, "author" | "authorPrefixMode" | "authorPrefixCustom">;

/** Full single-line author display, or `null` when there is no author name. */
export function formatStoryAuthorLine(doc: AuthorLineFields): string | null {
  const name = doc.author?.trim();
  if (!name) return null;
  const m = effectiveStoryAuthorPrefixMode(doc.authorPrefixMode);
  if (m === "none") return name;
  if (m === "by") return `By ${name}`;
  if (m === "author_label") return `Author: ${name}`;
  const custom = (doc.authorPrefixCustom ?? "").trim();
  if (!custom) return name;
  const needsSpace = !/\s$/.test(custom);
  return needsSpace ? `${custom} ${name}` : `${custom}${name}`;
}
