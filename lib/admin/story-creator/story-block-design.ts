import type { StoryBlockDesign } from "@/lib/admin/story-creator/story-types";

export const STORY_BLOCK_SCOPE_ATTR = "data-story-block-scope" as const;

/** CSS attribute selector for the block scope root (uses `CSS.escape` when available). */
export function storyBlockScopeSelector(blockId: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return `[${STORY_BLOCK_SCOPE_ATTR}="${CSS.escape(blockId)}"]`;
  }
  return `[${STORY_BLOCK_SCOPE_ATTR}="${blockId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

/**
 * Whitelist Tailwind-style class tokens: letters, numbers, dash, underscore.
 * Multiple classes = space-separated input; invalid tokens dropped.
 */
export function sanitizeStoryBlockDesignClassName(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /^[a-zA-Z0-9_:[\]/%+.,&~-]+$/.test(t));
  if (tokens.length === 0) return undefined;
  return tokens.join(" ");
}

/**
 * Wrap user-authored CSS in `@scope` so rules only apply under the block root with
 * `data-story-block-scope={blockId}`. Requires a browser that supports `@scope` (modern Chromium, Safari, Firefox).
 */
export function buildScopedStoryBlockStylesheet(blockId: string, css: string | undefined): string {
  const body = (css ?? "").trim();
  if (!body) return "";
  const root = storyBlockScopeSelector(blockId);
  return `@scope (${root}) {\n${body}\n}\n`;
}

/** Merge partial design; returns `undefined` when nothing remains. */
export function mergeStoryBlockDesign(
  existing: StoryBlockDesign | undefined,
  patch: Partial<StoryBlockDesign> | null,
): StoryBlockDesign | undefined {
  if (patch === null) return undefined;
  const next: StoryBlockDesign = { ...existing, ...patch };
  const className = sanitizeStoryBlockDesignClassName(next.className);
  const cssPart = next.css?.trim();
  if (!className && !cssPart) return undefined;
  const out: StoryBlockDesign = {};
  if (className) out.className = className;
  if (cssPart) out.css = next.css!.trim();
  return out;
}
