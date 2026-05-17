import type { StoryDocument } from "@/lib/admin/story-creator/story-types";
import type { StoryEditorHistoryState, StoryHistorySnapshot } from "@/features/story-creator/state/storyEditorTypes";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneSerializable(value: unknown, seen: WeakSet<object>): unknown {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => cloneSerializable(item, seen));
  }
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "object") {
    if (seen.has(value)) return undefined;
    if (!isPlainObject(value)) return undefined;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const next = cloneSerializable(v, seen);
      if (next !== undefined) out[k] = next;
    }
    return out;
  }
  return undefined;
}

/**
 * Deep-clone the live story document for undo/redo history.
 *
 * Zustand + Immer exposes `state.document` as a **draft Proxy** inside `set()`; browsers throw
 * `DataCloneError` when passing that to `structuredClone`. JSON round-trip yields a plain object,
 * matches how the document is persisted, and fails loudly in dev if non-JSON values slip in.
 */
export function cloneStoryDocumentForSnapshot(doc: StoryDocument): StoryDocument {
  try {
    return JSON.parse(JSON.stringify(doc)) as StoryDocument;
  } catch (jsonErr) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "StoryDocument could not be JSON-cloned (non-serializable value in document?).",
        jsonErr,
      );
    }
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(doc);
      } catch (cloneErr) {
        if (process.env.NODE_ENV === "development") {
          console.error("StoryDocument structuredClone also failed:", cloneErr);
        }
      }
    }
    return (cloneSerializable(doc, new WeakSet<object>()) ?? {}) as StoryDocument;
  }
}

export function makeSnapshot(
  document: StoryDocument,
  selectedBlockId: string | null,
  selectedSectionId: string | null,
  reason: string,
): StoryHistorySnapshot {
  return {
    document: cloneStoryDocumentForSnapshot(document),
    selectedBlockId,
    selectedSectionId,
    reason,
    timestamp: Date.now(),
  };
}

export function pushHistorySnapshot(
  history: StoryEditorHistoryState,
  snapshot: StoryHistorySnapshot,
): StoryEditorHistoryState {
  const past = [...history.past, snapshot];
  const cappedPast = past.length > history.limit ? past.slice(past.length - history.limit) : past;
  return { ...history, past: cappedPast, future: [] };
}
