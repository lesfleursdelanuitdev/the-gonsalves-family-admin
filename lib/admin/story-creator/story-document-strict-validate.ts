import type { StoryGeneralEmbedKind } from "@/lib/admin/story-creator/story-types";

type ValidationResult = { ok: true } | { ok: false; error: string };

const SECTION_BLOCK_TYPES = new Set([
  "richText",
  "media",
  "embed",
  "columns",
  "divider",
  "container",
  "table",
  "splitContent",
]);

const COLUMN_BLOCK_TYPES = new Set([
  "richText",
  "media",
  "embed",
  "columns",
  "container",
  "table",
  "splitContent",
]);

const SPLIT_SUPPORT_BLOCK_TYPES = new Set(["richText", "media", "embed", "table"]);

const GENERAL_EMBED_KINDS = new Set<StoryGeneralEmbedKind>([
  "document",
  "timeline",
  "map",
  "tree",
  "graph",
  "gallery",
  "personSpotlight",
  "familyGroup",
  "event",
]);

const LEGACY_EMBED_KINDS = new Set(["image", "video", "audio", "media"]);
const FLOW_DISPLAY_MODES = new Set(["block", "wrapped"]);
const FLOW_ALIGNS = new Set(["left", "right", "center"]);
const FLOW_SIZES = new Set(["small", "medium", "large", "full"]);
const FLOW_MEDIA_TYPES = new Set(["image", "video", "audio", "document"]);
const FLOW_EMBED_KINDS = new Set(["timeline", "tree", "gallery", "map", "personSpotlight", "familyGroup", "event"]);
const COLUMNS_MOBILE_BEHAVIORS = new Set(["stackLeftFirst", "stackRightFirst", "keepSideBySide"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function fail(path: string, msg: string): ValidationResult {
  return { ok: false, error: `${path}: ${msg}` };
}

function validateFlowLayout(node: Record<string, unknown>, path: string): ValidationResult {
  const attrs = node.attrs;
  if (!isRecord(attrs)) return fail(path, "flow node attrs must be an object");
  if (typeof attrs.id !== "string" || attrs.id.trim() === "") return fail(path, "flow node attrs.id must be a non-empty string");
  if (!FLOW_DISPLAY_MODES.has(String(attrs.displayMode))) return fail(path, "flow node displayMode is invalid");
  if (!FLOW_ALIGNS.has(String(attrs.align))) return fail(path, "flow node align is invalid");
  if (!FLOW_SIZES.has(String(attrs.size))) return fail(path, "flow node size is invalid");
  if (attrs.displayMode === "wrapped" && attrs.align === "center") return fail(path, "wrapped flow nodes cannot be center aligned");
  if (attrs.displayMode === "wrapped" && attrs.size === "full") return fail(path, "wrapped flow nodes cannot be full size");
  return { ok: true };
}

function validateTipTapNode(node: unknown, path: string): ValidationResult {
  if (!isRecord(node)) return fail(path, "TipTap node must be an object");
  if (typeof node.type !== "string" || node.type.trim() === "") return fail(path, "TipTap node.type must be a string");
  if (node.type === "storyFlowMedia") {
    const layout = validateFlowLayout(node, path);
    if (!layout.ok) return layout;
    const attrs = node.attrs as Record<string, unknown>;
    if (typeof attrs.mediaId !== "string" || attrs.mediaId.trim() === "") return fail(path, "storyFlowMedia.attrs.mediaId must be a non-empty string");
    if (attrs.mediaType != null && !FLOW_MEDIA_TYPES.has(String(attrs.mediaType))) return fail(path, "storyFlowMedia.attrs.mediaType is invalid");
  }
  if (node.type === "storyFlowEmbed") {
    const layout = validateFlowLayout(node, path);
    if (!layout.ok) return layout;
    const attrs = node.attrs as Record<string, unknown>;
    if (!FLOW_EMBED_KINDS.has(String(attrs.embedKind))) return fail(path, "storyFlowEmbed.attrs.embedKind is invalid");
    if (!isRecord(attrs.data)) return fail(path, "storyFlowEmbed.attrs.data must be an object");
  }
  if (node.content != null) {
    if (!Array.isArray(node.content)) return fail(path, "TipTap node.content must be an array when provided");
    for (let i = 0; i < node.content.length; i += 1) {
      const res = validateTipTapNode(node.content[i], `${path}.content[${i}]`);
      if (!res.ok) return res;
    }
  }
  return { ok: true };
}

function validateBlock(
  block: unknown,
  path: string,
  allowedTypes: Set<string>,
): ValidationResult {
  if (!isRecord(block)) return fail(path, "block must be an object");
  if (typeof block.id !== "string" || block.id.trim() === "") return fail(path, "block.id must be a non-empty string");
  if (typeof block.type !== "string") return fail(path, "block.type must be a string");
  if (!allowedTypes.has(block.type)) return fail(path, `block.type '${block.type}' is not allowed here`);

  if ("leftDoc" in block || "rightDoc" in block) {
    return fail(path, "legacy columns shape (leftDoc/rightDoc) is not accepted");
  }

  switch (block.type) {
    case "richText": {
      if (!isRecord(block.doc)) return fail(path, "richText.doc must be an object");
      if ("textPreset" in block) return fail(path, "legacy richText.textPreset is not accepted");
      return validateTipTapNode(block.doc, `${path}.doc`);
    }
    case "media": {
      if ("embedKind" in block) return fail(path, "legacy media shape with embedKind is not accepted");
      if (block.hideTitle != null && typeof block.hideTitle !== "boolean") return fail(path, "media.hideTitle must be a boolean when provided");
      if (block.hideCaption != null && typeof block.hideCaption !== "boolean") return fail(path, "media.hideCaption must be a boolean when provided");
      return { ok: true };
    }
    case "embed": {
      if (typeof block.embedKind !== "string") return fail(path, "embed.embedKind must be a string");
      if (LEGACY_EMBED_KINDS.has(block.embedKind)) {
        return fail(path, `legacy embedKind '${block.embedKind}' is not accepted`);
      }
      if (!GENERAL_EMBED_KINDS.has(block.embedKind as StoryGeneralEmbedKind)) {
        return fail(path, `unknown embedKind '${block.embedKind}'`);
      }
      if (block.data != null && !isRecord(block.data)) return fail(path, "embed.data must be an object when provided");
      if (block.presentation != null && !isRecord(block.presentation)) {
        return fail(path, "embed.presentation must be an object when provided");
      }
      if (block.hideTitle != null && typeof block.hideTitle !== "boolean") return fail(path, "embed.hideTitle must be a boolean when provided");
      if (block.hideCaption != null && typeof block.hideCaption !== "boolean") return fail(path, "embed.hideCaption must be a boolean when provided");
      return { ok: true };
    }
    case "columns": {
      if (!Array.isArray(block.columns) || block.columns.length !== 2) {
        return fail(path, "columns.columns must be a tuple with 2 slots");
      }
      if (block.mobileBehavior != null && !COLUMNS_MOBILE_BEHAVIORS.has(String(block.mobileBehavior))) {
        return fail(path, "columns.mobileBehavior is invalid");
      }
      if (block.advancedColumnLayoutEnabled != null && typeof block.advancedColumnLayoutEnabled !== "boolean") {
        return fail(path, "columns.advancedColumnLayoutEnabled must be a boolean when provided");
      }
      for (let i = 0; i < block.columns.length; i += 1) {
        const slot = block.columns[i];
        if (!isRecord(slot)) return fail(`${path}.columns[${i}]`, "column slot must be an object");
        if (!Array.isArray(slot.blocks)) return fail(`${path}.columns[${i}]`, "column slot blocks must be an array");
        for (let j = 0; j < slot.blocks.length; j += 1) {
          const inner = validateBlock(slot.blocks[j], `${path}.columns[${i}].blocks[${j}]`, COLUMN_BLOCK_TYPES);
          if (!inner.ok) return inner;
        }
      }
      return { ok: true };
    }
    case "divider":
      return { ok: true };
    case "container": {
      if (!isRecord(block.props)) return fail(path, "container.props must be an object");
      if ("containerPreset" in block.props) return fail(path, "legacy container.props.containerPreset is not accepted");
      if (!Array.isArray(block.children)) return fail(path, "container.children must be an array");
      for (let i = 0; i < block.children.length; i += 1) {
        const child = validateBlock(block.children[i], `${path}.children[${i}]`, SECTION_BLOCK_TYPES);
        if (!child.ok) return child;
      }
      return { ok: true };
    }
    case "table": {
      if ("hasHeadingRow" in block || "headers" in block || "rows" in block) {
        return fail(path, "legacy table shape (hasHeadingRow/headers/rows) is not accepted");
      }
      if (typeof block.rowCount !== "number" || !Number.isFinite(block.rowCount) || block.rowCount < 1) {
        return fail(path, "table.rowCount must be a positive number");
      }
      if (typeof block.columnCount !== "number" || !Number.isFinite(block.columnCount) || block.columnCount < 1) {
        return fail(path, "table.columnCount must be a positive number");
      }
      if (!Array.isArray(block.cells)) return fail(path, "table.cells must be an array");
      return { ok: true };
    }
    case "splitContent": {
      if (!isRecord(block.text) || block.text.type !== "richText") {
        return fail(path, "splitContent.text must be a richText block");
      }
      const textResult = validateBlock(block.text, `${path}.text`, SPLIT_SUPPORT_BLOCK_TYPES);
      if (!textResult.ok) return textResult;
      if (!isRecord(block.supporting)) return fail(path, "splitContent.supporting must be an object");
      if (!Array.isArray(block.supporting.blocks)) return fail(path, "splitContent.supporting.blocks must be an array");
      for (let i = 0; i < block.supporting.blocks.length; i += 1) {
        const support = validateBlock(
          block.supporting.blocks[i],
          `${path}.supporting.blocks[${i}]`,
          SPLIT_SUPPORT_BLOCK_TYPES,
        );
        if (!support.ok) return support;
      }
      return { ok: true };
    }
    default:
      return fail(path, `unknown block type '${String((block as { type?: unknown }).type ?? "")}'`);
  }
}

function validateSection(section: unknown, path: string): ValidationResult {
  if (!isRecord(section)) return fail(path, "section must be an object");
  if (typeof section.id !== "string" || section.id.trim() === "") return fail(path, "section.id must be a non-empty string");
  if (typeof section.title !== "string") return fail(path, "section.title must be a string");
  if (section.hideTitle != null && typeof section.hideTitle !== "boolean") return fail(path, "section.hideTitle must be a boolean when provided");
  if (section.hideSubtitle != null && typeof section.hideSubtitle !== "boolean") return fail(path, "section.hideSubtitle must be a boolean when provided");
  if (!Array.isArray(section.blocks)) return fail(path, "section.blocks must be an array");
  for (let i = 0; i < section.blocks.length; i += 1) {
    const res = validateBlock(section.blocks[i], `${path}.blocks[${i}]`, SECTION_BLOCK_TYPES);
    if (!res.ok) return res;
  }
  if (section.children != null) {
    if (!Array.isArray(section.children)) return fail(path, "section.children must be an array when provided");
    for (let i = 0; i < section.children.length; i += 1) {
      const child = validateSection(section.children[i], `${path}.children[${i}]`);
      if (!child.ok) return child;
    }
  }
  return { ok: true };
}

export function validateStoryDocumentStrictBlocks(doc: unknown): ValidationResult {
  if (!isRecord(doc)) return fail("doc", "must be an object");
  if (!Array.isArray(doc.sections)) return fail("doc.sections", "must be an array");
  for (let i = 0; i < doc.sections.length; i += 1) {
    const sec = validateSection(doc.sections[i], `doc.sections[${i}]`);
    if (!sec.ok) return sec;
  }
  return { ok: true };
}

