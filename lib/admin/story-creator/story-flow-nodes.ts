import type { JSONContent } from "@tiptap/core";
import type {
  StoryFlowAlign,
  StoryFlowDisplayMode,
  StoryFlowEmbedAttrs,
  StoryFlowEmbedKind,
  StoryFlowMediaAttrs,
  StoryFlowSize,
} from "@/lib/admin/story-creator/story-types";

export const STORY_FLOW_MEDIA_NODE = "storyFlowMedia";
export const STORY_FLOW_EMBED_NODE = "storyFlowEmbed";

export const STORY_FLOW_DISPLAY_MODES: StoryFlowDisplayMode[] = ["block", "wrapped"];
export const STORY_FLOW_ALIGNS: StoryFlowAlign[] = ["left", "center", "right"];
export const STORY_FLOW_SIZES: StoryFlowSize[] = ["small", "medium", "large", "full"];
export const STORY_FLOW_EMBED_KINDS: StoryFlowEmbedKind[] = [
  "timeline",
  "tree",
  "gallery",
  "map",
  "personSpotlight",
  "familyGroup",
  "event",
  "recipe",
];

type RecordLike = Record<string, unknown>;

export function newStoryFlowNodeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `flow_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function editableString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : {};
}

export function coerceStoryFlowLayout<T extends { displayMode?: unknown; align?: unknown; size?: unknown }>(raw: T): T & {
  displayMode: StoryFlowDisplayMode;
  align: StoryFlowAlign;
  size: StoryFlowSize;
} {
  const displayMode: StoryFlowDisplayMode = raw.displayMode === "wrapped" ? "wrapped" : "block";
  let align: StoryFlowAlign = raw.align === "left" || raw.align === "right" || raw.align === "center" ? raw.align : "center";
  let size: StoryFlowSize =
    raw.size === "small" || raw.size === "medium" || raw.size === "large" || raw.size === "full" ? raw.size : "medium";

  if (displayMode === "wrapped") {
    if (align === "center") align = "right";
    if (size === "full") size = "medium";
  }

  return { ...raw, displayMode, align, size };
}

export function defaultStoryFlowEmbedData(kind: StoryFlowEmbedKind): RecordLike {
  switch (kind) {
    case "tree":
      return { generations: 4, chartType: "pedigree" };
    case "timeline":
      return { sourceType: "storyEvents", timelineMode: "story", eventIds: [], eventXrefs: [] };
    case "gallery":
      return { sourceType: "custom", limit: 12 };
    case "map":
      return { eventIds: [], eventXrefs: [], mapMode: "events" };
    case "personSpotlight":
      return { fields: ["profileImage", "name", "lifespan"] };
    case "familyGroup":
    case "event":
      return {};
    case "recipe":
      return { ingredientGroups: [], stepGroups: [] };
  }
}

export function normalizeStoryFlowMediaAttrs(attrs: Partial<StoryFlowMediaAttrs>): StoryFlowMediaAttrs {
  const mediaId = cleanString(attrs.mediaId) ?? "";
  const mediaType = attrs.mediaType === "video" || attrs.mediaType === "audio" || attrs.mediaType === "document" ? attrs.mediaType : "image";
  return coerceStoryFlowLayout({
    id: cleanString(attrs.id) ?? newStoryFlowNodeId(),
    mediaId,
    mediaType,
    title: editableString(attrs.title),
    caption: editableString(attrs.caption),
    alt: typeof attrs.alt === "string" ? attrs.alt : undefined,
    credit: editableString(attrs.credit),
    displayMode: attrs.displayMode,
    align: attrs.align,
    size: attrs.size,
  });
}

export function normalizeStoryFlowEmbedAttrs(attrs: Partial<StoryFlowEmbedAttrs> | Record<string, unknown>): StoryFlowEmbedAttrs {
  const raw = attrs as Record<string, unknown>;
  const embedKind = STORY_FLOW_EMBED_KINDS.includes(raw.embedKind as StoryFlowEmbedKind)
    ? (raw.embedKind as StoryFlowEmbedKind)
    : "timeline";
  const rawPresentation = asRecord(raw.presentation);
  const chrome = rawPresentation.chrome === "none" || rawPresentation.chrome === "minimal" || rawPresentation.chrome === "full" ? rawPresentation.chrome : "minimal";
  const controls = typeof rawPresentation.controls === "boolean" ? rawPresentation.controls : false;
  return coerceStoryFlowLayout({
    id: cleanString(attrs.id) ?? newStoryFlowNodeId(),
    title: editableString(attrs.title),
    caption: editableString(attrs.caption),
    embedKind,
    data: Object.keys(asRecord(raw.data)).length > 0 ? asRecord(raw.data) : defaultStoryFlowEmbedData(embedKind),
    presentation: { chrome, controls },
    displayMode: attrs.displayMode,
    align: attrs.align,
    size: attrs.size,
  }) as StoryFlowEmbedAttrs;
}

export function storyFlowObjectClassName(attrs: {
  displayMode?: unknown;
  align?: unknown;
  size?: unknown;
  selected?: boolean;
}): string {
  const layout = coerceStoryFlowLayout(attrs);
  return [
    "story-flow-object",
    `story-flow-object--${layout.displayMode}`,
    `story-flow-object--${layout.align}`,
    `story-flow-object--${layout.size}`,
    attrs.selected ? "story-flow-object--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function mapTipTapContent(node: JSONContent, visitor: (node: JSONContent) => JSONContent): JSONContent {
  const next = visitor(node);
  if (!Array.isArray(next.content)) return next;
  return { ...next, content: next.content.map((child) => mapTipTapContent(child, visitor)) };
}

export function updateStoryFlowNodeInDoc(
  doc: JSONContent | Record<string, unknown>,
  nodeType: typeof STORY_FLOW_MEDIA_NODE | typeof STORY_FLOW_EMBED_NODE,
  nodeId: string,
  patch: Partial<StoryFlowMediaAttrs> | Partial<StoryFlowEmbedAttrs>,
): JSONContent {
  return mapTipTapContent(doc as JSONContent, (node) => {
    if (node.type !== nodeType || node.attrs?.id !== nodeId) return node;
    const attrs =
      nodeType === STORY_FLOW_MEDIA_NODE
        ? normalizeStoryFlowMediaAttrs({ ...(node.attrs as Partial<StoryFlowMediaAttrs>), ...(patch as Partial<StoryFlowMediaAttrs>), id: nodeId })
        : normalizeStoryFlowEmbedAttrs({ ...(node.attrs as Partial<StoryFlowEmbedAttrs>), ...(patch as Partial<StoryFlowEmbedAttrs>), id: nodeId });
    return { ...node, attrs };
  });
}

export function findStoryFlowNodeAttrs(
  doc: unknown,
  nodeType: typeof STORY_FLOW_MEDIA_NODE | typeof STORY_FLOW_EMBED_NODE,
  nodeId: string,
): StoryFlowMediaAttrs | StoryFlowEmbedAttrs | null {
  const stack: unknown[] = [doc];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    const rec = cur as { type?: unknown; attrs?: unknown; content?: unknown };
    if (rec.type === nodeType && asRecord(rec.attrs).id === nodeId) {
      return nodeType === STORY_FLOW_MEDIA_NODE
        ? normalizeStoryFlowMediaAttrs(rec.attrs as Partial<StoryFlowMediaAttrs>)
        : normalizeStoryFlowEmbedAttrs(rec.attrs as Partial<StoryFlowEmbedAttrs>);
    }
    if (Array.isArray(rec.content)) {
      for (let i = rec.content.length - 1; i >= 0; i -= 1) stack.push(rec.content[i]);
    }
  }
  return null;
}
