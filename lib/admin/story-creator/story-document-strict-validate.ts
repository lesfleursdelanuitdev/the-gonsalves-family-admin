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

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function fail(path: string, msg: string): ValidationResult {
  return { ok: false, error: `${path}: ${msg}` };
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
      return { ok: true };
    }
    case "media": {
      if ("embedKind" in block) return fail(path, "legacy media shape with embedKind is not accepted");
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
      return { ok: true };
    }
    case "columns": {
      if (!Array.isArray(block.columns) || block.columns.length !== 2) {
        return fail(path, "columns.columns must be a tuple with 2 slots");
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

