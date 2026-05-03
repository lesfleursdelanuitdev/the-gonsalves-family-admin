import type { StoryAuthorCredit, StoryAuthorPrefixMode, StoryDocument } from "@/lib/admin/story-creator/story-types";
import { newStoryId } from "@/lib/admin/story-creator/story-types";

export const STORY_AUTHOR_PREFIX_OPTIONS: {
  value: StoryAuthorPrefixMode;
  label: string;
  /** Example with the name “Alex Rivera” */
  example: string;
}[] = [
  { value: "by", label: "By", example: "By Alex Rivera" },
  { value: "author_label", label: "Author: ", example: "Author: Alex Rivera" },
  { value: "custom", label: "Custom", example: "e.g. Written by Alex Rivera" },
  { value: "none", label: "None", example: "Alex Rivera" },
];

const PREFIX_MODES = new Set<string>(["by", "author_label", "custom", "none"]);

export function effectiveStoryAuthorPrefixMode(mode: StoryAuthorPrefixMode | undefined): StoryAuthorPrefixMode {
  return mode ?? "by";
}

function parsePrefixMode(v: unknown): StoryAuthorPrefixMode | undefined {
  if (typeof v !== "string" || !PREFIX_MODES.has(v)) return undefined;
  return v as StoryAuthorPrefixMode;
}

/** Parse `authors` JSON from `stories.body` meta envelope. */
export function parseStoryAuthorsFromMetaArray(raw: unknown): StoryAuthorCredit[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryAuthorCredit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) continue;
    const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : newStoryId();
    const authorPrefixMode = parsePrefixMode(rec.authorPrefixMode);
    const authorPrefixCustom =
      typeof rec.authorPrefixCustom === "string" ? rec.authorPrefixCustom : undefined;
    out.push({ id, name, authorPrefixMode, authorPrefixCustom });
  }
  return out;
}

/** Credits for UI and formatting: `authors` when set, otherwise one legacy credit or empty. */
export function getStoryAuthorCredits(doc: Pick<StoryDocument, "authors" | "author" | "authorPrefixMode" | "authorPrefixCustom">): StoryAuthorCredit[] {
  if (doc.authors && doc.authors.length > 0) {
    return doc.authors.map((c) => ({
      ...c,
      id: c.id?.trim() ? c.id : newStoryId(),
      name: c.name.trim(),
    }));
  }
  const name = doc.author?.trim();
  if (!name) return [];
  return [
    {
      id: "legacy",
      name,
      authorPrefixMode: doc.authorPrefixMode,
      authorPrefixCustom: doc.authorPrefixCustom,
    },
  ];
}

type CreditLineFields = Pick<StoryAuthorCredit, "name" | "authorPrefixMode" | "authorPrefixCustom">;

/** One formatted byline, or `null` when the name is empty. */
export function formatStoryAuthorCreditLine(c: CreditLineFields): string | null {
  const name = c.name?.trim();
  if (!name) return null;
  const m = effectiveStoryAuthorPrefixMode(c.authorPrefixMode);
  if (m === "none") return name;
  if (m === "by") return `By ${name}`;
  if (m === "author_label") return `Author: ${name}`;
  const custom = (c.authorPrefixCustom ?? "").trim();
  if (!custom) return name;
  const needsSpace = !/\s$/.test(custom);
  return needsSpace ? `${custom} ${name}` : `${custom}${name}`;
}

/** Non-empty formatted lines in document order. */
export function formatStoryAuthorLines(doc: Pick<StoryDocument, "authors" | "author" | "authorPrefixMode" | "authorPrefixCustom">): string[] {
  return getStoryAuthorCredits(doc)
    .map((c) => formatStoryAuthorCreditLine(c))
    .filter((line): line is string => line != null && line.length > 0);
}

/** All credits joined for hero / cover (newline-separated). */
export function formatStoryAuthorLine(doc: Pick<StoryDocument, "authors" | "author" | "authorPrefixMode" | "authorPrefixCustom">): string | null {
  const lines = formatStoryAuthorLines(doc);
  if (lines.length === 0) return null;
  return lines.join("\n");
}
